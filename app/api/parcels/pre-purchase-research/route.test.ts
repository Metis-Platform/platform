import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  syncUserToDatabase: vi.fn(),
  rateLimitCount: vi.fn(),
  auditCreate: vi.fn(),
  parcelCacheFindMany: vi.fn(),
  jurisdictionFindFirst: vi.fn(),
  fmrFindMany: vi.fn(),
  resolveGoverningGeography: vi.fn(),
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
  },
}))
vi.mock('@/lib/parcel/enrich', () => ({ enrichParcel: mocks.enrichParcel }))
vi.mock('@/lib/geography/census-geocoder', () => ({
  CensusGeocoderError: class CensusGeocoderError extends Error {},
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
    mocks.enrichParcel.mockResolvedValue({ cacheHits: 0, apiCalls: 0, errors: [] })
    mocks.parcelCacheFindMany.mockResolvedValue([])
    mocks.jurisdictionFindFirst.mockResolvedValue(null)
    mocks.fmrFindMany.mockResolvedValue([])
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
  })
})
