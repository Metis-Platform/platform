import { describe, expect, it, vi } from 'vitest'
import {
  FEMA_DISASTER_DECLARATIONS_SOURCE_URL,
  fetchFemaDisasterDeclarations,
  femaDisasterDeclarationsQueryUrl,
} from './fema-disaster-declarations'

const response = (payload: unknown) => new Response(JSON.stringify(payload))

describe('OpenFEMA disaster declarations source', () => {
  it('queries the exact state and county FIPS and returns only a small official summary', async () => {
    const url = femaDisasterDeclarationsQueryUrl('12127')
    expect(url).toContain(FEMA_DISASTER_DECLARATIONS_SOURCE_URL)
    expect(new URL(url).searchParams.get('$filter')).toBe("fipsStateCode eq '12' and fipsCountyCode eq '127'")

    await expect(fetchFemaDisasterDeclarations('12127', vi.fn(() => Promise.resolve(response({ DisasterDeclarationsSummaries: [
      { disasterNumber: 4834, declarationDate: '2024-10-11T00:00:00.000Z', incidentType: 'Hurricane', declarationTitle: 'HURRICANE MILTON' },
    ] }))))).resolves.toEqual({
      femaDisasterDeclarationStatus: 'RECENT_DECLARATIONS_FOUND',
      femaRecentDisasterDeclarations: [{ disasterNumber: 4834, declarationDate: '2024-10-11T00:00:00.000Z', incidentType: 'Hurricane' }],
    })
  })

  it('keeps an empty official result distinct from a source failure', async () => {
    await expect(fetchFemaDisasterDeclarations('04013', vi.fn(() => Promise.resolve(response({ DisasterDeclarationsSummaries: [] })))))
      .resolves.toEqual({ femaDisasterDeclarationStatus: 'NO_RECENT_DECLARATIONS_RETURNED' })
  })

  it('fails closed for malformed input or payloads', async () => {
    expect(() => femaDisasterDeclarationsQueryUrl('0401')).toThrow('FEMA_DISASTER_DECLARATIONS_FIPS_INVALID')
    await expect(fetchFemaDisasterDeclarations('04013', vi.fn(() => Promise.resolve(response({ unexpected: [] })))))
      .rejects.toThrow('FEMA_DISASTER_DECLARATIONS_QUERY_FAILED')
  })
})
