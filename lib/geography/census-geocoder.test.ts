import { describe, expect, it, vi } from 'vitest'
import {
  CensusGeocoderError,
  censusAddressGeocoderUrl,
  censusGeocoderUrl,
  resolveCensusAddressLocation,
  resolveGoverningGeography,
} from './census-geocoder'

const response = (payload: unknown, ok = true) => ({ ok, json: async () => payload }) as Response

describe('Census governing geography resolver', () => {
  it('resolves county identity and an incorporated-place signal without claiming county governance', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response({
      result: { geographies: {
        Counties: [{ GEOID: '12127', NAME: 'Volusia County', STATE: '12' }],
        'Incorporated Places': [{ GEOID: '1217000', NAME: 'DeLand city' }],
      } },
    }))

    const result = await resolveGoverningGeography({ lat: 29.0283, lon: -81.3031 }, fetchImpl)

    expect(result).toMatchObject({
      countyFips: '12127', countyName: 'Volusia County', stateFips: '12',
      incorporatedPlace: { geoid: '1217000', name: 'DeLand city' },
      countyLandUseAuthorityStatus: 'UNRESOLVED',
      municipalityStatus: 'INCORPORATED_PLACE',
    })
    expect(fetchImpl).toHaveBeenCalledWith(expect.stringContaining('x=-81.3031'), expect.anything())
  })

  it('preserves uncertainty when no incorporated-place layer is returned', async () => {
    const result = await resolveGoverningGeography(
      { lat: 29, lon: -81 },
      vi.fn().mockResolvedValue(response({ result: { geographies: {
        Counties: [{ GEOID: '12127', NAME: 'Volusia County' }],
      } } })),
    )

    expect(result).toMatchObject({ municipalityStatus: 'NO_INCORPORATED_PLACE_RETURNED' })
    expect(result.incorporatedPlace).toBeUndefined()
    expect(result.countyLandUseAuthorityStatus).toBe('UNRESOLVED')
  })

  it('fails closed for missing county geography and transport failures', async () => {
    await expect(resolveGoverningGeography(
      { lat: 29, lon: -81 },
      vi.fn().mockResolvedValue(response({ result: { geographies: {} } })),
    )).rejects.toThrow('CENSUS_COUNTY_UNRESOLVED')
    await expect(resolveGoverningGeography(
      { lat: 29, lon: -81 },
      vi.fn().mockRejectedValue(new Error('network')),
    )).rejects.toThrow('CENSUS_GEOCODER_UNAVAILABLE')
  })

  it('uses the current official geography endpoint with longitude and latitude in the correct order', () => {
    expect(censusGeocoderUrl(29.0283, -81.3031)).toContain('x=-81.3031&y=29.0283')
  })

  it('resolves one Census address match with county geography', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response({ result: { addressMatches: [{
      coordinates: { x: -112.074, y: 33.4484 },
      matchedAddress: '1 MAIN ST, PHOENIX, AZ, 85001',
      geographies: { Counties: [{ GEOID: '04013', NAME: 'Maricopa County', STATE: '04' }] },
    }] } }))

    const result = await resolveCensusAddressLocation('1 Main St, Phoenix, AZ 85001', fetchImpl)

    expect(result).toMatchObject({
      lat: 33.4484, lon: -112.074, matchedAddress: '1 MAIN ST, PHOENIX, AZ, 85001', countyFips: '04013',
    })
    expect(fetchImpl).toHaveBeenCalledWith(expect.stringContaining('onelineaddress?address=1+Main+St'), expect.anything())
  })

  it('fails closed for no match, multiple matches, and malformed address results', async () => {
    await expect(resolveCensusAddressLocation('1 Main St, Phoenix, AZ', vi.fn().mockResolvedValue(response({ result: { addressMatches: [] } })))).rejects.toThrow('CENSUS_ADDRESS_UNRESOLVED')
    await expect(resolveCensusAddressLocation('1 Main St, Phoenix, AZ', vi.fn().mockResolvedValue(response({ result: { addressMatches: [{}, {}] } })))).rejects.toThrow('CENSUS_ADDRESS_AMBIGUOUS')
    await expect(resolveCensusAddressLocation('1 Main St, Phoenix, AZ', vi.fn().mockResolvedValue(response({ result: { addressMatches: [{}] } })))).rejects.toThrow('CENSUS_ADDRESS_UNRESOLVED')
    expect(() => censusAddressGeocoderUrl('1 Main St, Phoenix, AZ')).not.toThrow(CensusGeocoderError)
  })
})
