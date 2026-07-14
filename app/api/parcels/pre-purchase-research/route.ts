import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { syncUserToDatabase } from '@/lib/sync-user'
import { normalizeApn } from '@/lib/parcel/apn'
import { enrichParcel } from '@/lib/parcel/enrich'
import { buildJurisdictionFacts } from '@/lib/exit-engine/jurisdiction-facts'
import { evaluateExits } from '@/lib/exit-engine/engine'
import { assembleResearchProfile } from '@/lib/parcel/research-profile'
import { computeMao } from '@/lib/mao/calculator'
import { requestIdFromHeaders } from '@/lib/request-correlation'
import type { InvestorConstraints, ParcelProfile } from '@/lib/exit-engine/types'

const overridesSchema = z.object({
  lotSizeSqFt:     z.coerce.number().positive().optional(),
  lotSizeAcres:    z.coerce.number().positive().optional(),
  frontageLinearFt:z.coerce.number().positive().optional(),
  lotDepthFt:      z.coerce.number().positive().optional(),
  improved:        z.boolean().optional(),
  zoning:          z.string().max(30).optional(),
  floodZone:       z.string().max(20).optional(),
  assessedValue:   z.coerce.number().positive().optional(),
  roadFrontage:    z.enum(['paved', 'unpaved', 'easement_only', 'landlocked']).optional(),
  wetlandsPresent: z.boolean().optional(),
})

const requestSchema = z.object({
  apn:        z.string().min(1).max(80),
  fipsCounty: z.string().regex(/^\d{5}$/),
  lat:        z.number().min(-90).max(90).optional(),
  lon:        z.number().min(-180).max(180).optional(),
  maxBid:     z.coerce.number().positive().optional(),
  overrides:  overridesSchema.optional(),
})

const RATE_LIMIT_WINDOW_MS  = 60_000
const RATE_LIMIT_MAX        = 10
const RATE_LIMIT_ACTION     = 'PRE_PURCHASE_RESEARCH'

export async function POST(req: Request) {
  const synced = await syncUserToDatabase()
  if (!synced) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { tenant } = synced

  if (await isRateLimited(tenant.id)) {
    return NextResponse.json({ error: 'Too many research requests. Try again shortly.' }, { status: 429 })
  }

  const parsed = requestSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { apn, fipsCounty, lat, lon, maxBid, overrides } = parsed.data
  const normalized = normalizeApn(apn, fipsCounty)

  await db.auditEvent.create({
    data: {
      tenantId: tenant.id,
      userId:   synced.user.id,
      requestId: requestIdFromHeaders(req.headers),
      action:   RATE_LIMIT_ACTION,
      meta:     { apn: normalized.normalized, fipsCounty: normalized.fipsCounty },
    },
  })

  const enrichResult = await enrichParcel(
    normalized.normalized,
    normalized.fipsCounty,
    lat,
    lon,
    tenant.id,
  )

  const [cacheRows, jurisdiction] = await Promise.all([
    db.parcelDataCache.findMany({
      where: {
        tenantId:      tenant.id,
        apnNormalized: normalized.normalized,
        fipsCounty:    normalized.fipsCounty,
        expiresAt:     { gt: new Date() },
      },
    }),
    db.jurisdiction.findFirst({
      where:   { fips: normalized.fipsCounty },
      include: { strategyData: true },
    }),
  ])

  const fmrByBedroom = jurisdiction
    ? await loadFmrByBedroom(jurisdiction.state, jurisdiction.county)
    : {}

  const parcelOverrides: Partial<ParcelProfile> = {
    ...overrides,
    purchasePrice: maxBid,
  }

  const parcel = assembleResearchProfile(
    normalized.normalized,
    normalized.fipsCounty,
    jurisdiction?.state,
    jurisdiction?.county,
    cacheRows,
    parcelOverrides,
  )

  const investor: InvestorConstraints = {
    financing:       'CASH',
    maxPurchasePrice: maxBid,
  }

  const strategyData = jurisdiction?.strategyData[0] ?? null

  const ctx = {
    parcel,
    jurisdiction: buildJurisdictionFacts(strategyData, fmrByBedroom),
    investor,
    strategy: 'TAX_DEED' as const,
  }

  const exitResults = evaluateExits(ctx)
  const mao = computeMao(parcel, exitResults)

  return NextResponse.json({
    parcel,
    results:      exitResults,
    mao,
    jurisdiction: jurisdiction
      ? { id: jurisdiction.id, state: jurisdiction.state, county: jurisdiction.county }
      : null,
    enrich: {
      cacheHits: enrichResult.cacheHits,
      apiCalls:  enrichResult.apiCalls,
      errors:    enrichResult.errors,
    },
  })
}

async function loadFmrByBedroom(state: string, county: string): Promise<Record<number, number>> {
  const rates = await db.fmrRate.findMany({
    where:   { state, county },
    orderBy: { year: 'desc' },
  })
  const out: Record<number, number> = {}
  for (const r of rates) {
    if (out[r.bedrooms] != null) continue
    const amount = Number(r.amount.toString())
    if (Number.isFinite(amount)) out[r.bedrooms] = amount
  }
  return out
}

async function isRateLimited(tenantId: string): Promise<boolean> {
  const count = await db.auditEvent.count({
    where: {
      tenantId,
      action:    RATE_LIMIT_ACTION,
      createdAt: { gte: new Date(Date.now() - RATE_LIMIT_WINDOW_MS) },
    },
  })
  return count >= RATE_LIMIT_MAX
}
