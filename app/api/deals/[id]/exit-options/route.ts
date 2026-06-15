import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { syncUserToDatabase } from '@/lib/sync-user'
import { hasStrategy } from '@/lib/entitlements'
import { evaluateExits } from '@/lib/exit-engine/engine'
import { buildEvalContext } from '@/lib/exit-engine/load'
import type { DataGap, InvestorConstraints } from '@/lib/exit-engine/types'

const constraintsSchema = z.object({
  maxPurchasePrice: z.coerce.number().positive().optional(),
  improvementCapital: z.coerce.number().nonnegative().optional(),
  holdMonthsTolerance: z.coerce.number().int().nonnegative().optional(),
  targetRoi: z.coerce.number().nonnegative().optional(),
  financing: z.enum(['CASH', 'LENDER']).default('CASH'),
})

const GAP_LABELS: Record<string, string> = {
  arv: 'ARV',
  assessedValue: 'assessed value',
  bedroomCount: 'bed count',
  comparableRent: 'rent comp',
  improved: 'improvement status',
  lienFaceValue: 'lien face value',
  lotSizeSqFt: 'lot size',
  noi: 'NOI',
  purchasePrice: 'purchase price',
  rehabCost: 'rehab cost',
  structureSqFt: 'structure size',
  zoning: 'zoning',
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const synced = await syncUserToDatabase()
  if (!synced) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { tenant } = synced
  const { id: dealId } = await params

  const deal = await db.deal.findUnique({
    where: { id: dealId, tenantId: tenant.id },
    select: { purchasePrice: true, strategyType: true },
  })
  if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
  if (!await hasStrategy(tenant.id, deal.strategyType)) {
    return NextResponse.json({ error: 'Exit analysis requires this strategy module.' }, { status: 403 })
  }

  const parsed = constraintsSchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const investor: InvestorConstraints = {
    financing: parsed.data.financing,
    maxPurchasePrice: parsed.data.maxPurchasePrice ?? decimalToNumber(deal.purchasePrice),
    improvementCapital: parsed.data.improvementCapital,
    holdMonthsTolerance: parsed.data.holdMonthsTolerance,
    targetRoi: parsed.data.targetRoi == null ? undefined : parsed.data.targetRoi / 100,
  }
  const ctx = await buildEvalContext(dealId, tenant.id, investor)
  const results = evaluateExits(ctx).map(result => ({
    ...result,
    dataGaps: result.dataGaps.map(gap => decorateGap(gap, dealId)),
  }))

  return NextResponse.json({
    results,
    parcelCompleteness: ctx.parcel.dataCompleteness,
    parcelLastUpdated: ctx.parcel.lastUpdated.toISOString(),
  })
}

function decorateGap(gap: DataGap, dealId: string): DataGap {
  const label = gap.label ?? GAP_LABELS[gap.field] ?? labelize(gap.field)
  return {
    ...gap,
    label,
    deepLink: gap.deepLink ?? `/dashboard/deals/${dealId}/edit?focus=${encodeURIComponent(gap.field)}`,
  }
}

function labelize(value: string) {
  return value
    .replace(/([A-Z])/g, ' $1')
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase())
}

function decimalToNumber(value: { toString(): string } | number | null | undefined): number | undefined {
  if (value == null) return undefined
  const numberValue = typeof value === 'number' ? value : Number(value.toString())
  return Number.isFinite(numberValue) ? numberValue : undefined
}
