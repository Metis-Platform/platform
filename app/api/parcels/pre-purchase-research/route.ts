import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { syncUserToDatabase } from '@/lib/sync-user'
import { normalizeApn } from '@/lib/parcel/apn'
import { enrichParcel } from '@/lib/parcel/enrich'
import { buildJurisdictionFacts } from '@/lib/exit-engine/jurisdiction-facts'
import { EXIT_META } from '@/lib/exit-engine/keys'
import { evaluateExits } from '@/lib/exit-engine/engine'
import { assembleResearchProfile } from '@/lib/parcel/research-profile'
import { buildBidGates } from '@/lib/parcel/bid-gates'
import { computeMao } from '@/lib/mao/calculator'
import { requestIdFromHeaders } from '@/lib/request-correlation'
import {
  CensusGeocoderError,
  resolveCensusAddressLocation,
  resolveGoverningGeography,
  type CensusAddressLocation,
} from '@/lib/geography/census-geocoder'
import {
  OfficialParcelLocationError,
  resolveOfficialParcelLocation,
  type OfficialParcelLocation,
} from '@/lib/parcel/sources/volusia-property-appraiser'
import { resolveMaricopaOfficialParcelLocation } from '@/lib/parcel/sources/maricopa-property-assessor'
import { resolveOrangeOfficialParcelLocation } from '@/lib/parcel/sources/orange-property-appraiser'
import { resolveCountyLandUseAuthority } from '@/lib/jurisdiction-land-use-authority'
import { lookupUnincorporatedAuthorityBoundaryClaimIds } from '@/lib/jurisdiction-authority-boundary'
import { COUNTY_LAND_USE_AUTHORITY_SCOPE_FIELD } from '@/lib/jurisdiction-question-library'
import type { InvestorConstraints, ParcelProfile } from '@/lib/exit-engine/types'
import { prePurchaseResearchSnapshotPayload, researchSnapshotExpiry, researchSnapshotJson } from '@/lib/pre-purchase-research-snapshot'

const overridesSchema = z.object({
  lotSizeSqFt:     z.coerce.number().positive().optional(),
  lotSizeAcres:    z.coerce.number().positive().optional(),
  frontageLinearFt:z.coerce.number().positive().optional(),
  lotDepthFt:      z.coerce.number().positive().optional(),
  improved:        z.boolean().optional(),
  zoning:          z.string().max(30).optional(),
  floodZone:       z.string().max(20).optional(),
  assessedValue:   z.coerce.number().positive().optional(),
  marketValueEstimate: z.coerce.number().positive().optional(),
  landMarketType:  z.enum(['RURAL', 'INFILL']).optional(),
  roadFrontage:    z.enum(['paved', 'unpaved', 'easement_only', 'landlocked']).optional(),
  wetlandsPresent: z.boolean().optional(),
  manualSourceUrl: z.string().url().max(2048).optional(),
  manualVerification: z.literal(true).optional(),
}).superRefine((value, ctx) => {
  const hasManualFact = [
    'lotSizeSqFt', 'lotSizeAcres', 'frontageLinearFt', 'lotDepthFt', 'improved', 'zoning', 'floodZone',
    'assessedValue', 'marketValueEstimate', 'landMarketType', 'roadFrontage', 'wetlandsPresent',
  ].some(key => value[key as keyof typeof value] !== undefined)
  if (!hasManualFact) return
  if (!value.manualSourceUrl) ctx.addIssue({ code: 'custom', path: ['manualSourceUrl'], message: 'A source URL is required for manual parcel facts.' })
  if (!value.manualVerification) ctx.addIssue({ code: 'custom', path: ['manualVerification'], message: 'Confirm that you verified the manual facts against the supplied source.' })
})

const requestSchema = z.object({
  apn:        z.string().min(1).max(80),
  fipsCounty: z.string().regex(/^\d{5}$/),
  address:    z.string().trim().min(5).max(256).optional(),
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

  const { apn, fipsCounty, address, lat, lon, maxBid, overrides } = parsed.data
  const normalized = normalizeApn(apn, fipsCounty)
  const hasSuppliedCoordinates = lat != null && lon != null
  let officialParcelLocation: OfficialParcelLocation | null = null
  let censusAddressLocation: CensusAddressLocation | null = null
  let locationStatus: 'SUPPLIED' | 'OFFICIAL_PARCEL' | 'CENSUS_ADDRESS' | 'UNAVAILABLE' | 'UNRESOLVED' = hasSuppliedCoordinates
    ? 'SUPPLIED'
    : 'UNAVAILABLE'

  if (!hasSuppliedCoordinates) {
    try {
      officialParcelLocation = await resolveOfficialParcelLocation({
        apn: normalized.normalized,
        fipsCounty: normalized.fipsCounty,
      })
      officialParcelLocation ??= await resolveMaricopaOfficialParcelLocation({
        apn: normalized.normalized,
        fipsCounty: normalized.fipsCounty,
      })
      officialParcelLocation ??= await resolveOrangeOfficialParcelLocation({
        apn: normalized.normalized,
        fipsCounty: normalized.fipsCounty,
      })
      if (officialParcelLocation) locationStatus = 'OFFICIAL_PARCEL'
    } catch (error) {
      if (!(error instanceof OfficialParcelLocationError)) throw error
      locationStatus = 'UNRESOLVED'
    }
  }

  if (!hasSuppliedCoordinates && !officialParcelLocation && address) {
    try {
      censusAddressLocation = await resolveCensusAddressLocation(address)
      locationStatus = 'CENSUS_ADDRESS'
    } catch (error) {
      if (!(error instanceof CensusGeocoderError)) throw error
      locationStatus = 'UNRESOLVED'
    }
  }

  const resolvedLat = hasSuppliedCoordinates ? lat : officialParcelLocation?.lat ?? censusAddressLocation?.lat
  const resolvedLon = hasSuppliedCoordinates ? lon : officialParcelLocation?.lon ?? censusAddressLocation?.lon
  let governingGeography: Awaited<ReturnType<typeof resolveGoverningGeography>> | null = null
  let geographyStatus: 'RESOLVED' | 'UNRESOLVED' | 'COORDINATES_NOT_PROVIDED' = 'COORDINATES_NOT_PROVIDED'

  if (censusAddressLocation) {
    governingGeography = censusAddressLocation
    geographyStatus = 'RESOLVED'
    if (governingGeography.countyFips !== normalized.fipsCounty) {
      return NextResponse.json({
        error: 'Address resolves to a different county than the selected FIPS. Confirm the parcel location before applying county research.',
        selectedFipsCounty: normalized.fipsCounty,
        resolvedFipsCounty: governingGeography.countyFips,
      }, { status: 409 })
    }
  } else if (resolvedLat != null && resolvedLon != null) {
    try {
      governingGeography = await resolveGoverningGeography({ lat: resolvedLat, lon: resolvedLon })
      geographyStatus = 'RESOLVED'
      if (governingGeography.countyFips !== normalized.fipsCounty) {
        return NextResponse.json({
          error: 'Coordinates resolve to a different county than the selected FIPS. Confirm the parcel location before applying county research.',
          selectedFipsCounty: normalized.fipsCounty,
          resolvedFipsCounty: governingGeography.countyFips,
        }, { status: 409 })
      }
    } catch (error) {
      if (!(error instanceof CensusGeocoderError)) throw error
      geographyStatus = 'UNRESOLVED'
    }
  }

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
    resolvedLat,
    resolvedLon,
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
      include: {
        strategyData: true,
        claims: {
          where: {
            section: 'zoning',
            fieldKey: COUNTY_LAND_USE_AUTHORITY_SCOPE_FIELD,
            supersededByClaim: null,
          },
          select: {
            id: true,
            section: true,
            fieldKey: true,
            value: true,
            geographicScope: true,
            expectedAuthorityClass: true,
            sourceAuthorityClass: true,
            sourceAuthorityOwner: true,
            sourceAuthorityStatus: true,
            sourceAuthorityVerifiedAt: true,
            sourceAuthorityVerifiedBy: true,
            verificationState: true,
            reviewedAt: true,
            freshness: { select: { reviewDueAt: true, staleAt: true } },
            evidence: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: {
                sourceUrl: true,
                sourceUrlRecord: {
                  select: {
                    authorityClass: true,
                    authorityOwner: true,
                    authorityStatus: true,
                    authorityVerifiedAt: true,
                    authorityVerifiedBy: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
  ])

  const unincorporatedBoundaryClaimIds = jurisdiction && resolvedLat != null && resolvedLon != null
    ? await lookupUnincorporatedAuthorityBoundaryClaimIds(jurisdiction.id, resolvedLat, resolvedLon)
    : new Set<string>()
  const countyLandUseAuthority = resolveCountyLandUseAuthority(jurisdiction?.claims ?? [], {
    unincorporatedBoundaryClaimIds,
    incorporatedPlace: governingGeography?.municipalityStatus === 'INCORPORATED_PLACE',
  })

  const fmrByBedroom = jurisdiction
    ? await loadFmrByBedroom(jurisdiction.state, jurisdiction.county)
    : {}

  const { manualSourceUrl, ...manualOverrides } = overrides ?? {}
  delete manualOverrides.manualVerification
  const parcelOverrides: Partial<ParcelProfile> = {
    ...manualOverrides,
    purchasePrice: maxBid,
  }

  const parcel = assembleResearchProfile(
    normalized.normalized,
    normalized.fipsCounty,
    jurisdiction?.state,
    jurisdiction?.county,
    cacheRows,
    parcelOverrides,
    manualSourceUrl,
  )

  const investor: InvestorConstraints = {
    financing:       'CASH',
    maxPurchasePrice: maxBid,
  }

  const strategyData = jurisdiction?.strategyData[0] ?? null

  const ctx = {
    parcel,
    jurisdiction: buildJurisdictionFacts(strategyData, fmrByBedroom, {
      // A county-wide, current, reviewed authority declaration is the only scope that can
      // safely apply county land-use rules without a parcel-boundary resolver. County tax-sale
      // facts remain available separately.
      allowCountyLandUseRules: countyLandUseAuthority.status === 'VERIFIED',
    }),
    investor,
    strategy: 'TAX_DEED' as const,
  }

  const evaluatedExits = evaluateExits(ctx)
  const exitResults = countyLandUseAuthority.status === 'VERIFIED'
    ? evaluatedExits
    : evaluatedExits.map(result => EXIT_META[result.exitKey].family !== 'LIEN'
      ? {
          ...result,
          verdict: result.verdict === 'VIABLE' ? 'CONDITIONAL' as const : result.verdict,
          conditions: [...result.conditions, 'Governing local land-use authority is unresolved'],
        }
      : result)
  const mao = computeMao(parcel, exitResults)
  const bidGates = buildBidGates(parcel, countyLandUseAuthority.status)
  const handoff = jurisdiction
    ? await db.prePurchaseResearchSnapshot.create({
        data: {
          tenantId: tenant.id,
          jurisdictionId: jurisdiction.id,
          apn: parcel.apn,
          payload: researchSnapshotJson(prePurchaseResearchSnapshotPayload(parcel, exitResults, mao)) as never,
          expiresAt: researchSnapshotExpiry(),
        },
        select: { id: true, expiresAt: true },
      })
    : null

  return NextResponse.json({
    parcel,
    results:      exitResults,
    mao,
    bidGates,
    jurisdiction: jurisdiction
      ? { id: jurisdiction.id, state: jurisdiction.state, county: jurisdiction.county }
      : null,
    handoff: handoff ? { id: handoff.id, expiresAt: handoff.expiresAt } : null,
    geography: {
      status: geographyStatus,
      resolved: governingGeography,
      // Geography resolution identifies scope; it does not select a zoning or permitting authority.
      municipalityScope: governingGeography?.municipalityStatus ?? 'UNKNOWN',
      landUseAuthority: countyLandUseAuthority,
    },
    location: {
      status: locationStatus,
      sourceUrl: officialParcelLocation?.sourceUrl ?? censusAddressLocation?.sourceUrl,
      retrievedAt: officialParcelLocation?.retrievedAt ?? censusAddressLocation?.retrievedAt,
      // A returned geometry center only supplies a research coordinate; it is not a zoning or permitting determination.
      parcelId: officialParcelLocation?.parcelId,
      matchedAddress: censusAddressLocation?.matchedAddress,
    },
    enrich: {
      cacheHits: enrichResult.cacheHits,
      apiCalls:  enrichResult.apiCalls,
      errors:    enrichResult.errors,
      gaps:      enrichResult.gaps,
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
