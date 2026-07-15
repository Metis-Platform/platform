import { describe, expect, it, vi } from 'vitest'
import {
  OfficialParcelLocationError,
  resolveOfficialParcelLocation,
  volusiaParcelQueryUrl,
} from './volusia-property-appraiser'

const response = (payload: unknown, ok = true) => ({ ok, json: async () => payload }) as Response

const canonicalFeature = {
  attributes: { ALTKEY: 2340282, PID: '800401180260' },
  geometry: { rings: [[
    [-81.317, 28.968], [-81.316, 28.968], [-81.316, 28.969], [-81.317, 28.969], [-81.317, 28.968],
  ]] },
}

describe('Volusia Property Appraiser parcel resolver', () => {
  it('queries a normalized alternate key and returns an official parcel geometry center', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response({ features: [canonicalFeature] }))

    const result = await resolveOfficialParcelLocation({ apn: '0002340282', fipsCounty: '12127' }, fetchImpl)

    expect(result).toMatchObject({ parcelId: '800401180260', alternateKey: '2340282' })
    expect(result?.lat).toBeCloseTo(28.9685, 4)
    expect(result?.lon).toBeCloseTo(-81.3165, 4)
    expect(fetchImpl).toHaveBeenCalledWith(expect.stringContaining('where=ALTKEY%3D2340282'), expect.anything())
  })

  it('does not invent a Volusia source for another county', async () => {
    const fetchImpl = vi.fn()

    await expect(resolveOfficialParcelLocation({ apn: '1234', fipsCounty: '04013' }, fetchImpl)).resolves.toBeNull()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('fails closed for no match, ambiguous responses, and unavailable service', async () => {
    await expect(resolveOfficialParcelLocation(
      { apn: '2340282', fipsCounty: '12127' }, vi.fn().mockResolvedValue(response({ features: [] })),
    )).rejects.toThrow('VOLUSIA_PARCEL_NOT_FOUND')
    await expect(resolveOfficialParcelLocation(
      { apn: '2340282', fipsCounty: '12127' }, vi.fn().mockResolvedValue(response({ features: [canonicalFeature, canonicalFeature] })),
    )).rejects.toThrow('VOLUSIA_PARCEL_AMBIGUOUS')
    await expect(resolveOfficialParcelLocation(
      { apn: '2340282', fipsCounty: '12127' }, vi.fn().mockRejectedValue(new Error('network')),
    )).rejects.toThrow('VOLUSIA_PARCEL_SOURCE_UNAVAILABLE')
  })

  it('requests only the documented non-owner fields', () => {
    const url = volusiaParcelQueryUrl('0002340282')
    expect(url).toContain('outFields=ALTKEY%2CPID%2CLANDACRES%2CLANDSQFT%2CPC%2CPC_DESC%2CBLDGCOUNT%2CRES_TOTAL_SFLA')
    expect(url).not.toContain('OWNER')
    expect(url).toContain('outSR=4326')
  })

  it('rejects unsafe parcel identifiers before a request can be made', () => {
    expect(() => volusiaParcelQueryUrl("1' OR 1=1")).toThrow(OfficialParcelLocationError)
  })
})
