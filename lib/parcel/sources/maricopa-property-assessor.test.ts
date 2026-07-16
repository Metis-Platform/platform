import { describe, expect, it, vi } from 'vitest'
import { OfficialParcelLocationError } from './volusia-property-appraiser'
import { maricopaParcelQueryUrl, resolveMaricopaOfficialParcelLocation } from './maricopa-property-assessor'

const response = (payload: unknown, ok = true) => ({ ok, json: async () => payload }) as Response
const feature = {
  attributes: { APN: '13275012', JURISDICTION: 'PHOENIX', CITY_ZONING: 'R1-6' },
  geometry: { rings: [[[-112.075, 33.447], [-112.074, 33.447], [-112.074, 33.448], [-112.075, 33.448], [-112.075, 33.447]]] },
}

describe('Maricopa Assessor parcel resolver', () => {
  it('returns an official parcel interior point without treating jurisdiction fields as facts', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response({ features: [feature] }))
    const result = await resolveMaricopaOfficialParcelLocation({ apn: '13275012', fipsCounty: '04013' }, fetchImpl)
    expect(result).toMatchObject({ parcelId: '13275012' })
    expect(result?.lat).toBeCloseTo(33.4475, 4)
    expect(result?.lon).toBeCloseTo(-112.0745, 4)
    expect(fetchImpl).toHaveBeenCalledWith(expect.stringContaining('where=APN%3D%2713275012%27'), expect.anything())
  })

  it('does not query outside Maricopa and requests no owner fields', async () => {
    const fetchImpl = vi.fn()
    await expect(resolveMaricopaOfficialParcelLocation({ apn: '13275012', fipsCounty: '12127' }, fetchImpl)).resolves.toBeNull()
    expect(fetchImpl).not.toHaveBeenCalled()
    const url = maricopaParcelQueryUrl('13275012')
    expect(url).toContain('outFields=APN%2CJURISDICTION%2CCITY_ZONING')
    expect(url).not.toContain('OWNER')
    expect(url).toContain('outSR=4326')
  })

  it('fails closed for invalid identifiers, no match, and malformed geometry', async () => {
    expect(() => maricopaParcelQueryUrl("1' OR 1=1")).toThrow(OfficialParcelLocationError)
    await expect(resolveMaricopaOfficialParcelLocation({ apn: '13275012', fipsCounty: '04013' }, vi.fn().mockResolvedValue(response({ features: [] })))).rejects.toThrow('MARICOPA_PARCEL_NOT_FOUND')
    await expect(resolveMaricopaOfficialParcelLocation({ apn: '13275012', fipsCounty: '04013' }, vi.fn().mockResolvedValue(response({ features: [{ attributes: { APN: '13275012' }, geometry: { rings: [] } }] })))).rejects.toThrow('MARICOPA_PARCEL_LOCATION_UNRESOLVED')
  })
})
