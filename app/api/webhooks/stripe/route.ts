import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { db } from '@/lib/db'

// Stripe sends raw body — disable Next.js body parsing
export const dynamic = 'force-dynamic'

async function upsertSubscription(sub: Stripe.Subscription) {
  const customerId = sub.customer as string
  const tenant = await db.tenant.findUnique({ where: { stripeCustomerId: customerId } })
  if (!tenant) return

  // Map Stripe status → PlanTier
  let plan = tenant.plan
  if (sub.status === 'active' || sub.status === 'trialing') {
    const priceId = sub.items.data[0]?.price.id
    if (priceId === process.env.STRIPE_PRICE_STARTER) plan = 'STARTER'
    else if (priceId === process.env.STRIPE_PRICE_PROFESSIONAL) plan = 'PROFESSIONAL'
    else if (priceId === process.env.STRIPE_PRICE_TEAM) plan = 'TEAM'
  } else if (sub.status === 'canceled' || sub.status === 'unpaid') {
    plan = 'STARTER'
  }

  const trialEnd = sub.trial_end ? new Date(sub.trial_end * 1000) : null
  const periodEnd = sub.items.data[0]?.current_period_end
    ? new Date((sub.items.data[0].current_period_end as number) * 1000)
    : null

  await db.tenant.update({
    where: { id: tenant.id },
    data: {
      plan,
      stripeSubscriptionId: sub.id,
      stripeSubscriptionStatus: sub.status,
      trialEndsAt: trialEnd,
      currentPeriodEnd: periodEnd,
    },
  })
}

export async function POST(req: Request) {
  const body = await req.text()
  const sig = (await headers()).get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.mode === 'subscription' && session.customer && session.subscription) {
        // Link Stripe customer to tenant
        const tenantId = session.metadata?.tenantId
        if (tenantId) {
          await db.tenant.update({
            where: { id: tenantId },
            data: { stripeCustomerId: session.customer as string },
          })
        }
        const sub = await stripe.subscriptions.retrieve(session.subscription as string)
        await upsertSubscription(sub)
      }
      break
    }

    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      await upsertSubscription(sub)
      break
    }
  }

  return NextResponse.json({ received: true })
}
