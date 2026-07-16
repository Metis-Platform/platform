import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  upsert: vi.fn(),
  fetchFloodZone: vi.fn(),
  fetchNwiWetlands: vi.fn(),
  fetchSsurgoMapUnit: vi.fn(),
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
vi.mock('./sources/regrid', () => ({ fetchRegridParcel: vi.fn().mockResolvedValue({}) }))
vi.mock('./sources/fl-dor', () => ({ fetchFlDorParcel: vi.fn().mockResolvedValue({}) }))
vi.mock('./sources/census-acs', () => ({ fetchDemographics: vi.fn().mockResolvedValue({}) }))
vi.mock('./sources/epa-echo', () => ({ fetchEpaFlags: vi.fn().mockResolvedValue({}) }))
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

  it('reports FEMA service failure without caching a flood fact', async () => {
    mocks.fetchFloodZone.mockRejectedValue(new Error('FEMA_NFHL_QUERY_FAILED'))

    const result = await enrichParcel('13275012', '04013', 33.4484, -112.074, 'tenant-1')

    expect(result.errors).toContainEqual({ source: 'fema_nfhl', error: 'FEMA_NFHL_QUERY_FAILED' })
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
})
