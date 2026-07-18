import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  upsert: vi.fn(),
  fetchFloodZone: vi.fn(),
  fetchNwiWetlands: vi.fn(),
  fetchSsurgoMapUnit: vi.fn(),
  fetchUsgsElevation: vi.fn(),
  fetchUsgsHydrography: vi.fn(),
  fetchEpaFlags: vi.fn(),
  fetchDemographics: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: { parcelDataCache: { findMany: mocks.findMany, upsert: mocks.upsert } },
}))
vi.mock('./sources/fema-nfhl', () => ({
  FEMA_NFHL_SOURCE_URL: 'https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer',
  fetchFloodZone: mocks.fetchFloodZone,
}))
vi.mock('./sources/fws-nwi', () => ({
  FWS_NWI_SOURCE_URL: 'https://fwspublicservices.wim.usgs.gov/wetlandsmapservice/rest/services/Wetlands/MapServer/0',
  fetchNwiWetlands: mocks.fetchNwiWetlands,
}))
vi.mock('./sources/usda-ssurgo', () => ({
  USDA_SSURGO_SOURCE_URL: 'https://SDMDataAccess.sc.egov.usda.gov/Tabular/post.rest',
  fetchSsurgoMapUnit: mocks.fetchSsurgoMapUnit,
}))
vi.mock('./sources/usgs-3dep', () => ({
  USGS_3DEP_EPQS_SOURCE_URL: 'https://epqs.nationalmap.gov/v1/json',
  fetchUsgsElevation: mocks.fetchUsgsElevation,
}))
vi.mock('./sources/usgs-3dhp', () => ({
  USGS_3DHP_SOURCE_URL: 'https://3dhp.nationalmap.gov/arcgis/rest/services/usgs_3dhp_all/FeatureServer',
  fetchUsgsHydrography: mocks.fetchUsgsHydrography,
}))
vi.mock('./sources/regrid', () => ({ fetchRegridParcel: vi.fn().mockResolvedValue({}) }))
vi.mock('./sources/fl-dor', () => ({ fetchFlDorParcel: vi.fn().mockResolvedValue({}) }))
vi.mock('./sources/census-acs', () => ({
  CENSUS_ACS_2024_SOURCE_URL: 'https://api.census.gov/data/2024/acs/acs5',
  fetchDemographics: mocks.fetchDemographics,
}))
vi.mock('./sources/epa-echo', () => ({
  EPA_ECHO_CWA_SOURCE_URL: 'https://echodata.epa.gov/echo/cwa_rest_services.get_facilities',
  fetchEpaFlags: mocks.fetchEpaFlags,
}))
vi.mock('./sources/hifld-electric', () => ({ fetchElectricUtility: vi.fn().mockResolvedValue({}) }))
vi.mock('./sources/walk-score', () => ({ fetchWalkScore: vi.fn().mockResolvedValue({}) }))
vi.mock('./zoning/lookup', () => ({ lookupZoning: vi.fn().mockResolvedValue({}) }))
vi.mock('./zoning/decode', () => ({ decodeZoning: vi.fn().mockResolvedValue(null) }))

import { enrichParcel } from './enrich'

describe('parcel enrichment cache provenance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.findMany.mockResolvedValue([])
    mocks.upsert.mockResolvedValue({})
    mocks.fetchFloodZone.mockResolvedValue({ floodZone: 'X', floodPanel: '12127C0360J' })
    mocks.fetchNwiWetlands.mockResolvedValue({ wetlandsNwiStatus: 'NO_MAPPED_FEATURE' })
    mocks.fetchSsurgoMapUnit.mockResolvedValue({ soilMapUnitKey: '627422', soilMapUnitName: 'Gila loam' })
    mocks.fetchUsgsElevation.mockResolvedValue({ elevationFeet: 46.9 })
    mocks.fetchUsgsHydrography.mockResolvedValue({ hydrography3dhpStatus: 'NO_MAPPED_FEATURE' })
    mocks.fetchEpaFlags.mockResolvedValue({ epaCwaFacilitySearchStatus: 'NO_FACILITY_RETURNED' })
    mocks.fetchDemographics.mockResolvedValue({ medianHouseholdIncome: 80_000 })
  })

  it('stores the official FEMA source URL with each returned fact', async () => {
    const result = await enrichParcel('13275012', '04013', 33.4484, -112.074, 'tenant-1')

    expect(result.errors).toEqual([])
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        tenant: { connect: { id: 'tenant-1' } },
        source: 'fema_nfhl',
        field: 'floodZone',
        metadata: {
          source: 'fema_nfhl',
          sourceUrl: 'https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer',
        },
      }),
    }))
  })

  it('reports empty and partial source output without mislabeling explicit negative evidence', async () => {
    const result = await enrichParcel('13275012', '04013', 33.4484, -112.074, 'tenant-1')

    expect(result.gaps).toEqual(expect.arrayContaining([
      {
        source: 'regrid',
        fields: ['lotSizeSqFt', 'lotSizeAcres', 'assessedValue', 'assessedYear', 'landUseCode', 'improved', 'marketValueEstimate'],
      },
      { source: 'fws_nwi', fields: ['wetlandsPresent'] },
      { source: 'usgs_3dhp', fields: ['hydrography3dhpFeatureTypes'] },
      { source: 'epa_echo', fields: ['epaCwaFacilityNames'] },
      { source: 'hifld', fields: ['utilityName', 'serviceAreaType', 'electricAvailable'] },
    ]))
    expect(result.gaps.find(gap => gap.source === 'fws_nwi')?.fields).not.toContain('wetlandsNwiStatus')
    expect(result.gaps.find(gap => gap.source === 'usgs_3dhp')?.fields).not.toContain('hydrography3dhpStatus')
    expect(result.gaps.find(gap => gap.source === 'epa_echo')?.fields).not.toContain('epaCwaFacilitySearchStatus')
  })

  it('does not report a field missing when a fresh cached value supplies it', async () => {
    mocks.findMany.mockResolvedValue([{
      source: 'fema_nfhl', field: 'floodPanel', normalized: '04013C2205L', valueJson: '04013C2205L',
      expiresAt: new Date(Date.now() + 60_000), retrievedAt: new Date(), ttlHours: 8_760,
    }])
    mocks.fetchFloodZone.mockResolvedValue({ floodZone: 'X' })

    const result = await enrichParcel('13275012', '04013', 33.4484, -112.074, 'tenant-1')

    expect(result.cacheHits).toBe(1)
    expect(result.gaps.some(gap => gap.source === 'fema_nfhl')).toBe(false)
  })

  it('reports FEMA service failure without caching a flood fact', async () => {
    mocks.fetchFloodZone.mockRejectedValue(new Error('FEMA_NFHL_QUERY_FAILED'))

    const result = await enrichParcel('13275012', '04013', 33.4484, -112.074, 'tenant-1')

    expect(result.errors).toContainEqual({ source: 'fema_nfhl', error: 'FEMA_NFHL_QUERY_FAILED' })
    expect(result.gaps).toContainEqual({ source: 'fema_nfhl', fields: ['floodZone', 'floodPanel'] })
    expect(mocks.upsert).not.toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ source: 'fema_nfhl' }),
    }))
  })

  it('stores the official SSURGO source URL with returned map-unit evidence', async () => {
    await enrichParcel('13275012', '04013', 33.4484, -112.074, 'tenant-1')

    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        source: 'usda_ssurgo',
        field: 'soilMapUnitName',
        metadata: {
          source: 'usda_ssurgo',
          sourceUrl: 'https://SDMDataAccess.sc.egov.usda.gov/Tabular/post.rest',
        },
      }),
    }))
  })

  it('stores the official CWA endpoint only with accurately named facility search evidence', async () => {
    await enrichParcel('13275012', '04013', 33.4484, -112.074, 'tenant-1')

    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        source: 'epa_echo', field: 'epaCwaFacilitySearchStatus',
        metadata: {
          source: 'epa_echo',
          sourceUrl: 'https://echodata.epa.gov/echo/cwa_rest_services.get_facilities',
        },
      }),
    }))
    expect(mocks.upsert).not.toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ source: 'epa_echo', field: 'brownfieldFlag' }),
    }))
  })

  it('stores USGS interpolated elevation as source-disclosed preliminary evidence', async () => {
    await enrichParcel('13275012', '04013', 33.4484, -112.074, 'tenant-1')

    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        source: 'usgs_3dep', field: 'elevationFeet',
        metadata: { source: 'usgs_3dep', sourceUrl: 'https://epqs.nationalmap.gov/v1/json' },
      }),
    }))
  })

  it('reports a USGS service failure without caching an elevation fact', async () => {
    mocks.fetchUsgsElevation.mockRejectedValue(new Error('USGS_3DEP_QUERY_FAILED'))

    const result = await enrichParcel('13275012', '04013', 33.4484, -112.074, 'tenant-1')

    expect(result.errors).toContainEqual({ source: 'usgs_3dep', error: 'USGS_3DEP_QUERY_FAILED' })
    expect(mocks.upsert).not.toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ source: 'usgs_3dep' }),
    }))
  })

  it('stores USGS hydrography as source-disclosed point map evidence', async () => {
    await enrichParcel('13275012', '04013', 33.4484, -112.074, 'tenant-1')

    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        source: 'usgs_3dhp', field: 'hydrography3dhpStatus',
        metadata: { source: 'usgs_3dhp', sourceUrl: 'https://3dhp.nationalmap.gov/arcgis/rest/services/usgs_3dhp_all/FeatureServer' },
      }),
    }))
  })

  it('stores the exact official ACS vintage URL with demographic context', async () => {
    await enrichParcel('13275012', '04013', 33.4484, -112.074, 'tenant-1')

    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        source: 'census_acs', field: 'medianHouseholdIncome',
        metadata: {
          source: 'census_acs',
          sourceUrl: 'https://api.census.gov/data/2024/acs/acs5',
        },
      }),
    }))
  })
})
