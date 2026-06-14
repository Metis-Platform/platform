import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { isSuperAdmin } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import { StrategyType, ModuleTier } from '@/app/generated/prisma'

const Schema = z.object({
  tenantId: z.string().min(1),
  strategy: z.nativeEnum(StrategyType),
  tier: z.nativeEnum(ModuleTier).default('STANDARD'),
  trialDays: z.number().int().min(1).max(365).default(14),
})

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!(await isSuperAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { tenantId, strategy, tier, trialDays } = parsed.data
  const trialEndsAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000)

  const module_ = await db.tenantModule.upsert({
    where: { tenantId_strategy: { tenantId, strategy } },
    create: { tenantId, strategy, tier, trialEndsAt },
    update: { tier, trialEndsAt },
  })

  return NextResponse.json({ ...module_, trialEndsAt: module_.trialEndsAt?.toISOString() })
}
