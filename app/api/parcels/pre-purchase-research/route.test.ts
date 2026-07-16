import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  syncUserToDatabase: vi.fn(),
  rateLimitCount: vi.fn(),
  auditCreate: vi.fn(),
  parcelCacheFindMany: vi.fn(),
  jurisdictionFindFirst: vi.fn(),
  fmrFindMany: vi.fn(),
  researchSnapshotCreate: vi.fn(),
  resolveGoverningGeography: vi.fn(),
  resolveCensusAddressLocation: vi.fn(),
  resolveOfficialParcelLocation: vi.fn(),
  enrichParcel: vi.fn(),
}))

vi.mock('@/lib/sync-user', () => ({ syncUserToDatabase: mocks.syncUserToDatabase }))
vi.mock('@/lib/db', () => ({
  db: {
    auditEvent: { count: mocks.rateLimitCount, create: mocks.auditCreate },
    parcelDataCache: { findMany: mocks.parcelCacheFindMany },
    jurisdiction: { findFirst: mocks.jurisdictionFindFirst },
    fmrRate: { findMany: mocks.fmrFindMany },
    prePurchaseResearchSnapshot: { create: mocks.researchSnapshotCreate },
  },
}))
vi.mock('@/lib/parcel/enrich', () => ({ enrichParcel: mocks.enrichParcel }))
vi.mock('@/lib/geography/census-geocoder', () => ({
  CensusGeocoderError: class CensusGeocoderError extends Error {},
  resolveCensusAddressLocation: mocks.resolveCensusAddressLocation,
  resolveGoverningGeography: mocks.resolveGoverningGeography,
}))
vi.mock('@/lib/parcel/sources/volusia-property-appraiser', () => ({
  OfficialParcelLocationError: class OfficialParcelLocationError extends Error {},
  resolveOfficialParcelLocation: mocks.resolveOfficialParcelLocation,
}))

import { POST } from './route'

describe('pre-purchase research governing geography', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.syncUserToDatabase.mockResolvedValue({ tenant: { id: 'tenant-1' }, user: { id: 'user-1' } })
    mocks.rateLimitCount.mockResolvedValue(0)
    mocks.resolveOfficialParcelLocation.mockResolvedValue(null)
    mocks.resolveCensusAddressLocation.mockResolvedValue(null)
    mocks.enrichParcel.mockResolvedValue({ cacheHits: 0, apiCalls: 0, errors: [] })
    mocks.parcelCacheFindMany.mockResolvedValue([])
    mocks.jurisdictionFindFirst.mockResolvedValue(null)
    mocks.fmrFindMany.mockResolvedValue([])
    mocks.researchSnapshotCreate.mockResolvedValue({
      id: 'snapshot-1', expiresAt: new Date('2026-07-15T01:00:00.000Z'),
    })
  })

  it('keeps the canonical Volusia parcel conditional through the full research route', async () => {
    mocks.resolveOfficialParcelLocation.mockResolvedValue({
      lat: 28.9685, lon: -81.3165, parcelId: '800401180260',
      sourceUrl: 'https://maps1.vcgov.org/arcgis/rest/services/Property_Appraiser/MapServer',
      retrievedAt: '2026-07-15T00:00:00.000Z',
    })
    mocks.resolveGoverningGeography.mockResolvedValue({ countyFips: '12127', countyName: 'Volusia County' })
    mocks.jurisdictionFindFirst.mockResolvedValue({
      id: 'jurisdiction-1', state: 'FL', county: 'Volusia',
      strategyData: [{
        data: {
          zoning_codes: {
            'R-4': {
              minLotSizeSqFt: 7_500,
              minLotWidthFt: 75,
              setbacks: { front: 25, side: 8, rear: 20 },
            },
          },
        },
      }],
    })

    const manualSourceUrl = 'https://vcpa.vcgov.org/parcel/summary/?altkey=2340282'
    const response = await POST(new Request('https://metis.example/api/parcels/pre-purchase-research', {
      method: 'POST',
      body: JSON.stringify({
        apn: '2340282',
        fipsCounty: '12127',
        overrides: {
          lotSizeSqFt: 5_000,
          frontageLinearFt: 50,
          lotDepthFt: 100,
          improved: false,
          zoning: 'R-4',
          marketValueEstimate: 100_000,
          landMarketType: 'INFILL',
          manualSourceUrl,
          manualVerification: true,
        },
      }),
    }))

    expect(response.status).toBe(200)
    const body = await response.json()
    const builder = body.results.find((result: { exitKey: string }) => result.exitKey === 'VACANT_SELL_TO_BUILDER')
    const landMao = body.mao.find((result: { strategy: string }) => result.strategy === 'LAND')

    expect(body).toMatchObject({
      parcel: {
        apn: '0002340282', lotSizeSqFt: 5_000, frontageLinearFt: 50, lotDepthFt: 100, zoning: 'R-4',
        sources: {
          lotSizeSqFt: { provider: 'manual', sourceUrl: manualSourceUrl },
          zoning: { provider: 'manual', sourceUrl: manualSourceUrl },
        },
      },
      location: { status: 'OFFICIAL_PARCEL', parcelId: '800401180260' },
      geography: { status: 'RESOLVED' },
      handoff: { id: 'snapshot-1' },
    })
    expect(builder).toMatchObject({
      verdict: 'CONDITIONAL',
      blockers: expect.arrayContaining([
        'Lot is smaller than jurisdiction minimum lot size',
        'Lot frontage is smaller than jurisdiction minimum width',
      ]),
      buildableEnvelope: { widthFt: 34, depthFt: 55, areaSqFt: 1_870 },
    })
    expect(builder.conditions.join(' ')).toContain('nonconforming-lot eligibility')
    expect(landMao).toMatchObject({
      scenario: { conservative: 40_000, moderate: 55_000, aggressive: 70_000 },
      basis: 'Market value estimate $100K × 40-70%',
    })
    expect(mocks.researchSnapshotCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        tenantId: 'tenant-1', jurisdictionId: 'jurisdiction-1', apn: '0002340282',
        payload: expect.objectContaining({ version: 1 }),
      }),
    }))
  })

  it('keeps a Maricopa parcel preliminary when county zoning authority is unresolved', async () => {
    const retrievedAt = new Date('2026-07-16T00:00:00.000Z')
    mocks.resolveCensusAddressLocation.mockResolvedValue({
      lat: 33.4484, lon: -112.074, matchedAddress: '1 W JEFFERSON ST, PHOENIX, AZ, 85003',
      countyFips: '04013', countyName: 'Maricopa County', municipalityStatus: 'INCORPORATED',
      sourceUrl: 'https://geocoding.geo.census.gov/geocoder', retrievedAt: '2026-07-16T00:00:00.000Z',
    })
    mocks.jurisdictionFindFirst.mockResolvedValue({
      id: 'maricopa-jurisdiction', state: 'AZ', county: 'Maricopa', strategyData: [],
    })
    mocks.parcelCacheFindMany.mockResolvedValue([{
      id: 'fema-cache-1', tenantId: 'tenant-1', apnNormalized: '13275012', fipsCounty: '04013',
      source: 'fema_nfhl', field: 'floodZone', valueJson: 'X', normalized: 'X', retrievedAt,
      ttlHours: 8_760, expiresAt: new Date('2027-07-16T00:00:00.000Z'),
      metadata: {
        source: 'fema_nfhl',
        sourceUrl: 'https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer',
      },
      createdAt: retrievedAt, updatedAt: retrievedAt,
    }])
    const sourceUrl = 'https://gis.mcassessor.maricopa.gov/arcgis/rest/services/Parcels/MapServer/0'

    const response = await POST(new Request('https://metis.example/api/parcels/pre-purchase-research', {
      method: 'POST',
      body: JSON.stringify({
        apn: '13275012', fipsCounty: '04013', address: '1 W Jefferson St, Phoenix, AZ 85003',
        overrides: { improved: false, manualSourceUrl: sourceUrl, manualVerification: true },
      }),
    }))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toMatchObject({
      parcel: {
        apn: '13275012', improved: false, floodZone: 'X',
        sources: {
          improved: { provider: 'manual', sourceUrl },
          floodZone: {
            provider: 'fema_nfhl', retrievedAt: retrievedAt.toISOString(),
            sourceUrl: 'https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer',
          },
        },
      },
      location: { status: 'CENSUS_ADDRESS' },
      geography: { status: 'RESOLVED', municipalityScope: 'INCORPORATED' },
      handoff: { id: 'snapshot-1' },
    })
    expect(body.parcel.zoning).toBeUndefined()
    expect(body.results.some((result: { verdict: string }) => result.verdict === 'VIABLE')).toBe(false)
  })

  it('uses an official Volusia parcel location before applying county research', async () => {
    mocks.resolveOfficialParcelLocation.mockResolvedValue({
      lat: 28.9685, lon: -81.3165, parcelId: '800401180260',
      sourceUrl: 'https://maps5.vcgov.org/example', retrievedAt: '2026-07-15T00:00:00.000Z',
    })
    mocks.resolveGoverningGeography.mockResolvedValue({ countyFips: '12127', countyName: 'Volusia County' })

    const response = await POST(new Request('https://metis.example/api/parcels/pre-purchase-research', {
      method: 'POST', body: JSON.stringify({ apn: '2340282', fipsCounty: '12127' }),
    }))

    expect(mocks.resolveGoverningGeography).toHaveBeenCalledWith({ lat: 28.9685, lon: -81.3165 })
    await expect(response.json()).resolves.toMatchObject({
      location: { status: 'OFFICIAL_PARCEL', parcelId: '800401180260' },
      geography: { status: 'RESOLVED' },
    })
  })

  it('does not audit when an official parcel location resolves to another county', async () => {
    mocks.resolveOfficialParcelLocation.mockResolvedValue({ lat: 33.4484, lon: -112.074, parcelId: 'wrong-county' })
    mocks.resolveGoverningGeography.mockResolvedValue({ countyFips: '04013', countyName: 'Maricopa County' })

    const response = await POST(new Request('https://metis.example/api/parcels/pre-purchase-research', {
      method: 'POST', body: JSON.stringify({ apn: '2340282', fipsCounty: '12127' }),
    }))

    expect(response.status).toBe(409)
    expect(mocks.auditCreate).not.toHaveBeenCalled()
  })

  it('refuses to apply selected county research when supplied coordinates resolve to another county', async () => {
    mocks.resolveGoverningGeography.mockResolvedValue({ countyFips: '04013', countyName: 'Maricopa County' })

    const response = await POST(new Request('https://metis.example/api/parcels/pre-purchase-research', {
      method: 'POST',
      body: JSON.stringify({ apn: '1234', fipsCounty: '12127', lat: 33.4484, lon: -112.074 }),
    }))

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      selectedFipsCounty: '12127', resolvedFipsCounty: '04013',
    })
    expect(mocks.auditCreate).not.toHaveBeenCalled()
    expect(mocks.resolveOfficialParcelLocation).not.toHaveBeenCalled()
    expect(mocks.resolveCensusAddressLocation).not.toHaveBeenCalled()
  })

  it('uses Census address location as a nationwide preliminary fallback', async () => {
    mocks.resolveCensusAddressLocation.mockResolvedValue({
      lat: 33.4484, lon: -112.074, matchedAddress: '1 MAIN ST, PHOENIX, AZ, 85001',
      countyFips: '04013', countyName: 'Maricopa County', sourceUrl: 'https://census.example', retrievedAt: '2026-07-15T00:00:00.000Z',
    })

    const response = await POST(new Request('https://metis.example/api/parcels/pre-purchase-research', {
      method: 'POST', body: JSON.stringify({ apn: '1234', fipsCounty: '04013', address: '1 Main St, Phoenix, AZ 85001' }),
    }))

    expect(mocks.resolveGoverningGeography).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toMatchObject({
      location: { status: 'CENSUS_ADDRESS', sourceUrl: 'https://census.example', matchedAddress: '1 MAIN ST, PHOENIX, AZ, 85001' },
      geography: { status: 'RESOLVED' },
    })
  })

  it('does not audit when a Census address resolves to another county', async () => {
    mocks.resolveCensusAddressLocation.mockResolvedValue({
      lat: 33.4484, lon: -112.074, matchedAddress: '1 MAIN ST, PHOENIX, AZ, 85001',
      countyFips: '04013', countyName: 'Maricopa County', sourceUrl: 'https://census.example', retrievedAt: '2026-07-15T00:00:00.000Z',
    })

    const response = await POST(new Request('https://metis.example/api/parcels/pre-purchase-research', {
      method: 'POST', body: JSON.stringify({ apn: '1234', fipsCounty: '12127', address: '1 Main St, Phoenix, AZ 85001' }),
    }))

    expect(response.status).toBe(409)
    expect(mocks.auditCreate).not.toHaveBeenCalled()
  })
})
