import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { isSuperAdmin } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import { StrategyType, ModuleTier } from '@/app/generated/prisma'

const UpsertSchema = z.object({
  strategy: z.nativeEnum(StrategyType),
  tier: z.nativeEnum(ModuleTier),
  stripePriceId: z.string().nullable().optional(),
  displayPrice: z.number().positive().nullable().optional(),
  currency: z.string().length(3).default('usd'),
  isActive: z.boolean().default(true),
})

export async function GET(): Promise<NextResponse> {
  if (!(await isSuperAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const prices = await db.modulePrice.findMany({
    orderBy: [{ strategy: 'asc' }, { tier: 'asc' }],
  })
  return NextResponse.json(prices)
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!(await isSuperAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const parsed = UpsertSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { strategy, tier, stripePriceId, displayPrice, currency, isActive } = parsed.data

  const price = await db.modulePrice.upsert({
    where: { strategy_tier: { strategy, tier } },
    create: {
      strategy,
      tier,
      stripePriceId: stripePriceId ?? null,
      displayPrice: displayPrice ?? null,
      currency,
      isActive,
    },
    update: {
      stripePriceId: stripePriceId ?? null,
      displayPrice: displayPrice ?? null,
      currency,
      isActive,
    },
  })

  return NextResponse.json(price, { status: 201 })
}
