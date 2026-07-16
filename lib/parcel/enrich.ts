import { Prisma, type ParcelDataCache } from '@/app/generated/prisma'
import { db } from '@/lib/db'
import type { ParcelProfile } from '@/lib/exit-engine/types'
import { fetchDemographics } from './sources/census-acs'
import { fetchEpaFlags } from './sources/epa-echo'
import { FEMA_NFHL_SOURCE_URL, fetchFloodZone } from './sources/fema-nfhl'
import { fetchFlDorParcel } from './sources/fl-dor'
import { fetchElectricUtility } from './sources/hifld-electric'
import { fetchRegridParcel } from './sources/regrid'
import { SOURCE_TTL_HOURS, type ParcelSourceName } from './sources/types'
import { fetchWalkScore } from './sources/walk-score'
import { decodeZoning } from './zoning/decode'
import { lookupZoning } from './zoning/lookup'

export interface EnrichResult {
  profile: Partial<ParcelProfile>
  cacheHits: number
  apiCalls: number
  errors: Array<{ source: string; error: string }>
}

interface SourcePlan {
  source: ParcelSourceName
  sourceUrl?: string
  fields: Array<keyof ParcelProfile | string>
  fetch: () => Promise<Record<string, unknown>>
}

const PARCEL_FACT_FIELDS = [
  'lotSizeSqFt',
  'lotSizeAcres',
  'assessedValue',
  'assessedYear',
  'landUseCode',
  'improved',
  'marketValueEstimate',
] as const

export async function enrichParcel(
  apnNormalized: string,
  fipsCounty: string,
  lat?: number,
  lon?: number,
  tenantId?: string,
): Promise<EnrichResult> {
  if (!tenantId) throw new Error('tenantId is required for parcel enrichment')

  const now = new Date()
  const plans = buildSourcePlans(apnNormalized, fipsCounty, lat, lon)
  const cacheRows = await db.parcelDataCache.findMany({
    where: {
      tenantId,
      apnNormalized,
      fipsCounty,
      source: { in: plans.map(plan => plan.source) },
    },
  })
  const profile: Partial<ParcelProfile> = {}
  let cacheHits = 0
  let apiCalls = 0
  const errors: EnrichResult['errors'] = []

  const results = await Promise.all(plans.map(async (plan) => {
    const cached = freshRowsForPlan(cacheRows, plan, now)
    for (const row of cached) {
      assignProfileValue(profile, row.field, row.normalized ?? row.valueJson)
    }
    cacheHits += cached.length

    const missingFields = plan.fields.filter(field => !cached.some(row => row.field === field))
    if (missingFields.length === 0) return

    try {
      apiCalls += 1
      const fetched = await plan.fetch()
      const rows = rowsFromFetched({
        tenantId,
        apnNormalized,
        fipsCounty,
        source: plan.source,
        sourceUrl: plan.sourceUrl,
        fields: missingFields,
        fetched,
        now,
      })

      await Promise.all(rows.map(row => db.parcelDataCache.upsert({
        where: {
          tenantId_apnNormalized_fipsCounty_source_field: {
            tenantId,
            apnNormalized,
            fipsCounty,
            source: plan.source,
            field: row.field,
          },
        },
        create: row,
        update: {
          valueJson: row.valueJson,
          normalized: row.normalized,
          retrievedAt: row.retrievedAt,
          ttlHours: row.ttlHours,
          expiresAt: row.expiresAt,
          metadata: row.metadata,
        },
      })))

      for (const row of rows) assignProfileValue(profile, row.field, row.normalized ?? row.valueJson)
    } catch (error) {
      errors.push({ source: plan.source, error: error instanceof Error ? error.message : 'Unknown error' })
    }
  }))

  await Promise.all(results)

  return { profile, cacheHits, apiCalls, errors }
}

function buildSourcePlans(
  apnNormalized: string,
  fipsCounty: string,
  lat?: number,
  lon?: number,
): SourcePlan[] {
  const plans: SourcePlan[] = [
    {
      source: fipsCounty.startsWith('12') ? 'fl_dor' : 'regrid',
      fields: [...PARCEL_FACT_FIELDS],
      fetch: async () => fipsCounty.startsWith('12')
        ? fetchFlDorParcel(apnNormalized, fipsCounty)
        : fetchRegridParcel(apnNormalized, fipsCounty),
    },
    {
      source: 'census_acs',
      fields: ['medianHouseholdIncome', 'renterOccupancyPct', 'vacancyRatePct', 'populationDensity'],
      fetch: async () => fetchDemographics(fipsCounty),
    },
  ]

  if (lat != null && lon != null) {
    plans.push(
      {
        source: 'fema_nfhl',
        sourceUrl: FEMA_NFHL_SOURCE_URL,
        fields: ['floodZone', 'floodPanel'],
        fetch: async () => fetchFloodZone(lat, lon),
      },
      {
        source: 'epa_echo',
        fields: ['brownfieldFlag', 'undergroundTankFlag', 'superfundProximity', 'facilities'],
        fetch: async () => fetchEpaFlags(lat, lon),
      },
      {
        source: 'walk_score',
        fields: ['walkScore', 'transitScore', 'bikeScore'],
        fetch: async () => fetchWalkScore(lat, lon, `${lat},${lon}`),
      },
      {
        source: 'hifld',
        fields: ['utilityName', 'serviceAreaType', 'electricAvailable'],
        fetch: async () => fetchElectricUtility(lat, lon),
      },
      {
        source: 'postgis_zoning',
        fields: ['zoning', 'zoningDescription'],
        fetch: async () => fetchZoningProfile(lat, lon, fipsCounty),
      },
    )
  }

  return plans
}

async function fetchZoningProfile(lat: number, lon: number, fipsCounty: string): Promise<Record<string, unknown>> {
  const zoning = await lookupZoning(lat, lon, fipsCounty)
  if (!zoning.zoneCode) return {}

  const decoded = await decodeZoning(fipsCounty, zoning.zoneCode)
  return {
    zoning: zoning.zoneCode,
    zoningDescription: decoded?.description ?? zoning.zoneName ?? undefined,
  }
}

function freshRowsForPlan(cacheRows: ParcelDataCache[], plan: SourcePlan, now: Date): ParcelDataCache[] {
  return cacheRows.filter(row =>
    row.source === plan.source
    && plan.fields.includes(row.field)
    && row.expiresAt.getTime() > now.getTime()
  )
}

function rowsFromFetched(params: {
  tenantId: string
  apnNormalized: string
  fipsCounty: string
  source: ParcelSourceName
  sourceUrl?: string
  fields: string[]
  fetched: Record<string, unknown>
  now: Date
}): Array<Prisma.ParcelDataCacheCreateInput & { tenant: { connect: { id: string } } }> {
  const ttlHours = SOURCE_TTL_HOURS[params.source]
  const expiresAt = new Date(params.now.getTime() + ttlHours * 60 * 60 * 1000)

  return params.fields
    .filter(field => params.fetched[field] !== undefined)
    .map(field => ({
      tenant: { connect: { id: params.tenantId } },
      apnNormalized: params.apnNormalized,
      fipsCounty: params.fipsCounty,
      source: params.source,
      field,
      valueJson: toJsonValue(params.fetched[field]),
      normalized: toJsonValue(params.fetched[field]),
      retrievedAt: params.now,
      ttlHours,
      expiresAt,
      metadata: {
        source: params.source,
        ...(params.sourceUrl ? { sourceUrl: params.sourceUrl } : {}),
      },
    }))
}

function assignProfileValue(profile: Partial<ParcelProfile>, field: string, value: unknown): void {
  if (!isProfileKey(field)) return
  ;(profile as Record<string, unknown>)[field] = value
}

function isProfileKey(field: string): field is keyof ParcelProfile {
  return [
    ...PARCEL_FACT_FIELDS,
    'floodZone',
    'floodPanel',
    'zoning',
    'zoningDescription',
    'brownfieldFlag',
    'undergroundTankFlag',
    'electricAvailable',
  ].includes(field as typeof PARCEL_FACT_FIELDS[number])
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue
}
