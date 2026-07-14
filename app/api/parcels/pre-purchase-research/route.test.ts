import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  syncUserToDatabase: vi.fn(),
  rateLimitCount: vi.fn(),
  auditCreate: vi.fn(),
  resolveGoverningGeography: vi.fn(),
}))

vi.mock('@/lib/sync-user', () => ({ syncUserToDatabase: mocks.syncUserToDatabase }))
vi.mock('@/lib/db', () => ({
  db: { auditEvent: { count: mocks.rateLimitCount, create: mocks.auditCreate } },
}))
vi.mock('@/lib/geography/census-geocoder', () => ({
  CensusGeocoderError: class CensusGeocoderError extends Error {},
  resolveGoverningGeography: mocks.resolveGoverningGeography,
}))

import { POST } from './route'

describe('pre-purchase research governing geography', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.syncUserToDatabase.mockResolvedValue({ tenant: { id: 'tenant-1' }, user: { id: 'user-1' } })
    mocks.rateLimitCount.mockResolvedValue(0)
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
  })
})
