import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { stripe, PLAN_PRICES } from '@/lib/stripe'
import { db } from '@/lib/db'
import { syncUserToDatabase } from '@/lib/sync-user'

const schema = z.object({ plan: z.enum(['STARTER', 'PROFESSIONAL', 'TEAM']) })

export async function POST(req: Request) {
  await auth()
  const result = await syncUserToDatabase()
  if (!result) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })

  const { plan } = parsed.data
  const priceId = PLAN_PRICES[plan]
  if (!priceId) return NextResponse.json({ error: 'Plan not configured' }, { status: 500 })

  const { tenant } = result

  // Re-use existing Stripe customer or create one
  let customerId = tenant.stripeCustomerId
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: result.user.email,
      name: tenant.name,
      metadata: { tenantId: tenant.id },
    })
    customerId = customer.id
    await db.tenant.update({ where: { id: tenant.id }, data: { stripeCustomerId: customerId } })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: 14,
      metadata: { tenantId: tenant.id },
    },
    metadata: { tenantId: tenant.id },
    success_url: `${appUrl}/dashboard/billing?success=1`,
    cancel_url: `${appUrl}/dashboard/billing`,
  })

  return NextResponse.json({ url: session.url })
}
