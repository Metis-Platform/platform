import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { syncUserToDatabase } from '@/lib/sync-user'
import { hasStrategy } from '@/lib/entitlements'
import { normalizeApn } from '@/lib/parcel/apn'
import { evaluateExits } from '@/lib/exit-engine/engine'
import { buildEvalContext } from '@/lib/exit-engine/load'
import type { DataGap, ExitResult, InvestorConstraints, ParcelProfile } from '@/lib/exit-engine/types'

const ENGINE_VERSION = 'exit-engine:v1'
const CACHE_TTL_HOURS = 6

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
    select: {
      purchasePrice: true,
      strategyType: true,
      property: {
        select: {
          apn: true,
          jurisdiction: { select: { fips: true } },
        },
      },
    },
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
  const force = req.nextUrl.searchParams.get('force') === 'true'

  if (!force) {
    const cached = await readCachedEvaluation(dealId, tenant.id, deal.property.apn, deal.property.jurisdiction.fips, investor)
    if (cached) return NextResponse.json(cached)
  }

  const ctx = await buildEvalContext(dealId, tenant.id, investor)
  const results = evaluateExits(ctx).map(result => ({
    ...result,
    dataGaps: result.dataGaps.map(gap => decorateGap(gap, dealId)),
  }))
  const now = new Date()
  const expiresAt = new Date(now.getTime() + CACHE_TTL_HOURS * 60 * 60 * 1000)

  await db.exitEvaluation.create({
    data: {
      tenantId: tenant.id,
      dealId,
      investorProfile: toJson(investor),
      results: toJson(results),
      parcelSnapshot: toJson(ctx.parcel),
      evaluatedAt: now,
      expiresAt,
      version: ENGINE_VERSION,
    },
  })

  return NextResponse.json({
    results,
    parcelCompleteness: ctx.parcel.dataCompleteness,
    parcelLastUpdated: ctx.parcel.lastUpdated.toISOString(),
  })
}

async function readCachedEvaluation(
  dealId: string,
  tenantId: string,
  apn: string,
  fipsCounty: string | null,
  investor: InvestorConstraints,
): Promise<{ results: ExitResult[]; parcelCompleteness: number; parcelLastUpdated: string; cached: true } | null> {
  const cache = await db.exitEvaluation.findFirst({
    where: {
      tenantId,
      dealId,
      version: ENGINE_VERSION,
      expiresAt: { gt: new Date() },
    },
    orderBy: { evaluatedAt: 'desc' },
  })
  if (!cache) return null
  if (stableJson(cache.investorProfile) !== stableJson(investor)) return null
  if (!fipsCounty) return cachedResponse(cache.results, cache.parcelSnapshot)

  const normalized = normalizeApn(apn, fipsCounty)
  const newestParcelData = await db.parcelDataCache.findFirst({
    where: {
      tenantId,
      apnNormalized: normalized.normalized,
      fipsCounty: normalized.fipsCounty,
      retrievedAt: { gt: cache.evaluatedAt },
    },
    select: { id: true },
  })
  if (newestParcelData) return null

  return cachedResponse(cache.results, cache.parcelSnapshot)
}

function cachedResponse(results: unknown, parcelSnapshot: unknown) {
  const parcel = parcelSnapshot as Partial<ParcelProfile>
  return {
    results: Array.isArray(results) ? results as ExitResult[] : [],
    parcelCompleteness: typeof parcel.dataCompleteness === 'number' ? parcel.dataCompleteness : 0,
    parcelLastUpdated: typeof parcel.lastUpdated === 'string' ? parcel.lastUpdated : new Date().toISOString(),
    cached: true as const,
  }
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

function toJson(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as object
}

function stableJson(value: unknown): string {
  if (value == null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  return `{${Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
    .join(',')}}`
}
