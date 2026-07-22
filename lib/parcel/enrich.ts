import { Prisma, type ParcelDataCache } from '@/app/generated/prisma'
import { db } from '@/lib/db'
import type { ParcelProfile } from '@/lib/exit-engine/types'
import { CENSUS_ACS_2024_SOURCE_URL, fetchDemographics } from './sources/census-acs'
import { EPA_ECHO_CWA_SOURCE_URL, fetchEpaFlags } from './sources/epa-echo'
import { FEMA_NFHL_SOURCE_URL, fetchFloodZone } from './sources/fema-nfhl'
import { FEMA_DISASTER_DECLARATIONS_SOURCE_URL, fetchFemaDisasterDeclarations } from './sources/fema-disaster-declarations'
import { FWS_NWI_SOURCE_URL, fetchNwiWetlands } from './sources/fws-nwi'
import { fetchElectricUtility, HIFLD_ELECTRIC_RETAIL_TERRITORIES_SOURCE_URL } from './sources/hifld-electric'
import {
  fetchOfficialHarrisParcelFacts,
  HARRIS_FIPS,
  harrisParcelQueryUrl,
} from './sources/harris-property-appraiser'
import {
  fetchOfficialOrangeParcelFacts,
  orangeParcelQueryUrl,
  ORANGE_FIPS,
} from './sources/orange-property-appraiser'
import { fetchRegridParcel } from './sources/regrid'
import { SOURCE_TTL_HOURS, type ParcelSourceName } from './sources/types'
import { USDA_SSURGO_SOURCE_URL, fetchSsurgoMapUnit } from './sources/usda-ssurgo'
import { USGS_3DEP_EPQS_SOURCE_URL, fetchUsgsElevation } from './sources/usgs-3dep'
import { USGS_3DHP_SOURCE_URL, fetchUsgsHydrography } from './sources/usgs-3dhp'
import { USGS_PADUS_FEDERAL_FEE_SOURCE_URL, fetchPadusFederalFeeManagers } from './sources/usgs-padus'
import {
  fetchOfficialVolusiaParcelFacts,
  VOLUSIA_FIPS,
  volusiaParcelQueryUrl,
} from './sources/volusia-property-appraiser'
import { fetchWalkScore } from './sources/walk-score'
import { decodeZoning } from './zoning/decode'
import { lookupZoning } from './zoning/lookup'

export interface EnrichResult {
  profile: Partial<ParcelProfile>
  cacheHits: number
  apiCalls: number
  errors: Array<{ source: string; error: string }>
  gaps: EnrichmentGap[]
}

export interface EnrichmentGap {
  source: ParcelSourceName
  fields: string[]
}

interface SourcePlan {
  source: ParcelSourceName
  sourceUrl?: string
  fields: Array<keyof ParcelProfile | string>
  fetch?: () => Promise<Record<string, unknown>>
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

  const sourceGaps = await Promise.all(plans.map(async (plan): Promise<EnrichmentGap | null> => {
    const cached = freshRowsForPlan(cacheRows, plan, now)
    for (const row of cached) {
      assignProfileValue(profile, row.field, row.normalized ?? row.valueJson)
    }
    cacheHits += cached.length

    const missingFields = plan.fields.filter(field => !cached.some(row => row.field === field))
    if (missingFields.length === 0) return null
    if (!plan.fetch) return { source: plan.source, fields: missingFields.map(String) }

    try {
      apiCalls += 1
      const fetched = await plan.fetch()
      const unresolvedFields = missingFields.filter(field => fetched[field] === undefined)
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
      return unresolvedFields.length > 0
        ? { source: plan.source, fields: unresolvedFields.map(String) }
        : null
    } catch (error) {
      errors.push({ source: plan.source, error: error instanceof Error ? error.message : 'Unknown error' })
      return { source: plan.source, fields: missingFields.map(String) }
    }
  }))

  return {
    profile,
    cacheHits,
    apiCalls,
    errors,
    gaps: sourceGaps.filter((gap): gap is EnrichmentGap => gap != null),
  }
}

function buildSourcePlans(
  apnNormalized: string,
  fipsCounty: string,
  lat?: number,
  lon?: number,
): SourcePlan[] {
  const plans: SourcePlan[] = [
    parcelBaselinePlan(apnNormalized, fipsCounty),
    {
      source: 'census_acs',
      sourceUrl: CENSUS_ACS_2024_SOURCE_URL,
      fields: ['medianHouseholdIncome', 'renterOccupancyPct', 'vacancyRatePct', 'populationDensity'],
      fetch: async () => fetchDemographics(fipsCounty),
    },
    {
      source: 'fema_disaster_declarations',
      sourceUrl: FEMA_DISASTER_DECLARATIONS_SOURCE_URL,
      fields: ['femaDisasterDeclarationStatus', 'femaRecentDisasterDeclarations'],
      fetch: async () => fetchFemaDisasterDeclarations(fipsCounty),
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
        source: 'fws_nwi',
        sourceUrl: FWS_NWI_SOURCE_URL,
        fields: ['wetlandsPresent', 'wetlandsNwiStatus'],
        fetch: async () => fetchNwiWetlands(lat, lon),
      },
      {
        source: 'usda_ssurgo',
        sourceUrl: USDA_SSURGO_SOURCE_URL,
        fields: ['soilMapUnitKey', 'soilMapUnitName', 'soilFarmlandClassification'],
        fetch: async () => (await fetchSsurgoMapUnit(lat, lon)) ?? {},
      },
      {
        source: 'usgs_3dep',
        sourceUrl: USGS_3DEP_EPQS_SOURCE_URL,
        fields: ['elevationFeet'],
        fetch: async () => fetchUsgsElevation(lat, lon),
      },
      {
        source: 'usgs_3dhp',
        sourceUrl: USGS_3DHP_SOURCE_URL,
        fields: ['hydrography3dhpStatus', 'hydrography3dhpFeatureTypes'],
        fetch: async () => fetchUsgsHydrography(lat, lon),
      },
      {
        source: 'usgs_padus',
        sourceUrl: USGS_PADUS_FEDERAL_FEE_SOURCE_URL,
        fields: ['padusFederalFeeStatus', 'padusFederalFeeManagerNames'],
        fetch: async () => fetchPadusFederalFeeManagers(lat, lon),
      },
      {
        source: 'epa_echo',
        sourceUrl: EPA_ECHO_CWA_SOURCE_URL,
        fields: ['epaCwaFacilitySearchStatus', 'epaCwaFacilityNames'],
        fetch: async () => fetchEpaFlags(lat, lon),
      },
      {
        source: 'walk_score',
        fields: ['walkScore', 'transitScore', 'bikeScore'],
        fetch: async () => fetchWalkScore(lat, lon, `${lat},${lon}`),
      },
      {
        source: 'hifld',
        sourceUrl: HIFLD_ELECTRIC_RETAIL_TERRITORIES_SOURCE_URL,
        fields: ['hifldElectricTerritoryStatus', 'hifldElectricUtilityNames', 'hifldElectricServiceTypes'],
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

function parcelBaselinePlan(apnNormalized: string, fipsCounty: string): SourcePlan {
  if (fipsCounty === VOLUSIA_FIPS) {
    let sourceUrl: string | undefined
    try {
      sourceUrl = volusiaParcelQueryUrl(apnNormalized)
    } catch {
      // The fetch path reports the invalid identifier as a fail-closed source gap.
    }
    return {
      source: 'volusia_property_appraiser',
      sourceUrl,
      fields: [...PARCEL_FACT_FIELDS],
      fetch: async () => fetchOfficialVolusiaParcelFacts({ apn: apnNormalized, fipsCounty }),
    }
  }

  if (fipsCounty === HARRIS_FIPS) {
    let sourceUrl: string | undefined
    try {
      sourceUrl = harrisParcelQueryUrl(apnNormalized)
    } catch {
      // The fetch path reports the invalid identifier as a fail-closed source gap.
    }
    return {
      source: 'harris_property_appraiser',
      sourceUrl,
      fields: [...PARCEL_FACT_FIELDS],
      fetch: async () => fetchOfficialHarrisParcelFacts({ apn: apnNormalized, fipsCounty }),
    }
  }

  if (fipsCounty === ORANGE_FIPS) {
    let sourceUrl: string | undefined
    try {
      sourceUrl = orangeParcelQueryUrl(apnNormalized)
    } catch {
      // The fetch path reports the invalid identifier as a fail-closed source gap.
    }
    return {
      source: 'orange_property_appraiser',
      sourceUrl,
      fields: [...PARCEL_FACT_FIELDS],
      fetch: async () => fetchOfficialOrangeParcelFacts({ apn: apnNormalized, fipsCounty }),
    }
  }

  if (fipsCounty.startsWith('12')) {
    return {
      source: 'fl_dor',
      fields: [...PARCEL_FACT_FIELDS],
    }
  }

  return {
    source: 'regrid',
    fields: [...PARCEL_FACT_FIELDS],
    fetch: async () => fetchRegridParcel(apnNormalized, fipsCounty),
  }
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
    'femaDisasterDeclarationStatus',
    'femaRecentDisasterDeclarations',
    'wetlandsPresent',
    'wetlandsNwiStatus',
    'soilMapUnitKey',
    'soilMapUnitName',
    'soilFarmlandClassification',
    'elevationFeet',
    'hydrography3dhpStatus',
    'hydrography3dhpFeatureTypes',
    'padusFederalFeeStatus',
    'padusFederalFeeManagerNames',
    'zoning',
    'zoningDescription',
    'brownfieldFlag',
    'undergroundTankFlag',
    'epaCwaFacilitySearchStatus',
    'epaCwaFacilityNames',
    'hifldElectricTerritoryStatus',
    'hifldElectricUtilityNames',
    'hifldElectricServiceTypes',
    'electricAvailable',
  ].includes(field as typeof PARCEL_FACT_FIELDS[number])
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue
}
