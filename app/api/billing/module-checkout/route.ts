import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getStripe } from '@/lib/stripe'
import { db } from '@/lib/db'
import { syncUserToDatabase } from '@/lib/sync-user'
import { StrategyType } from '@/app/generated/prisma'

const schema = z.object({
  strategy: z.nativeEnum(StrategyType),
  tier: z.enum(['STANDARD', 'PREMIUM']).default('STANDARD'),
})

export async function POST(req: Request) {
  const result = await syncUserToDatabase()
  if (!result) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { strategy, tier } = parsed.data
  const { tenant } = result

  // Check if module already owned
  const existing = await db.tenantModule.findUnique({
    where: { tenantId_strategy: { tenantId: tenant.id, strategy } },
  })
  if (existing && (existing.tier === tier || tier === 'STANDARD')) {
    return NextResponse.json({ error: 'Module already owned' }, { status: 409 })
  }

  const priceId =
    tier === 'PREMIUM'
      ? process.env.STRIPE_MODULE_PRICE_PREMIUM_ID
      : process.env.STRIPE_MODULE_PRICE_STANDARD_ID

  if (!priceId) {
    return NextResponse.json({ error: 'Purchase not configured — contact support@metisplatforms.com' }, { status: 503 })
  }

  // Re-use or create Stripe customer
  let customerId = tenant.stripeCustomerId
  if (!customerId) {
    const customer = await getStripe().customers.create({
      email: result.user.email,
      name: tenant.name,
      metadata: { tenantId: tenant.id },
    })
    customerId = customer.id
    await db.tenant.update({ where: { id: tenant.id }, data: { stripeCustomerId: customerId } })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const session = await getStripe().checkout.sessions.create({
    customer: customerId,
    mode: 'payment',
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: {
      type: 'module',
      tenantId: tenant.id,
      strategy,
      tier,
    },
    success_url: `${appUrl}/dashboard/billing?module_success=1`,
    cancel_url: `${appUrl}/dashboard/billing`,
  })

  return NextResponse.json({ url: session.url })
}
