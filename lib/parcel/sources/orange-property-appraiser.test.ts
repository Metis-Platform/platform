import { describe, expect, it, vi } from 'vitest'
import {
  fetchOfficialOrangeParcelFacts,
  normalizeOrangeParcelAttributes,
  orangeParcelQueryUrl,
  resolveOrangeOfficialParcelLocation,
} from './orange-property-appraiser'
import { OfficialParcelLocationError } from './volusia-property-appraiser'

const response = (payload: unknown, ok = true) => ({ ok, json: async () => payload }) as Response
const feature = {
  attributes: {
    PARCEL: '152541080010',
    ACREAGE: 0.25,
    TOTAL_ASSD: 125_000,
    LAND_DOR_CODE: '0100',
    LIVING_AREA: 1_820,
  },
  geometry: { rings: [[[-81.4, 28.5], [-81.3, 28.5], [-81.3, 28.6], [-81.4, 28.6], [-81.4, 28.5]]] },
}

describe('Orange County Property Appraiser parcel baseline', () => {
  it('returns only source-supported preliminary parcel facts', async () => {
    const facts = await fetchOfficialOrangeParcelFacts(
      { apn: '152541080010', fipsCounty: '12095' },
      vi.fn().mockResolvedValue(response({ features: [feature] })),
    )

    expect(facts).toEqual({
      lotSizeAcres: 0.25, lotSizeSqFt: 10_890, assessedValue: 125_000, landUseCode: '0100', improved: true,
    })
    expect(facts).not.toHaveProperty('marketValueEstimate')
    expect(facts).not.toHaveProperty('zoning')
  })

  it('resolves a parcel interior point only for Orange County', async () => {
    const location = await resolveOrangeOfficialParcelLocation(
      { apn: '152541080010', fipsCounty: '12095' },
      vi.fn().mockResolvedValue(response({ features: [feature] })),
    )

    expect(location?.parcelId).toBe('152541080010')
    expect(location?.lat).toBeCloseTo(28.55)
    expect(location?.lon).toBeCloseTo(-81.35)
    await expect(resolveOrangeOfficialParcelLocation({ apn: '152541080010', fipsCounty: '12127' }, vi.fn())).resolves.toBeNull()
  })

  it('fails closed for invalid identifiers and ambiguous source responses', async () => {
    expect(() => orangeParcelQueryUrl("1' OR 1=1")).toThrow(OfficialParcelLocationError)
    await expect(fetchOfficialOrangeParcelFacts(
      { apn: '152541080010', fipsCounty: '12095' }, vi.fn().mockResolvedValue(response({ features: [feature, feature] })),
    )).rejects.toThrow('ORANGE_PARCEL_AMBIGUOUS')
  })

  it('requests only documented non-PII fields', () => {
    const url = orangeParcelQueryUrl('152541080010')
    expect(url).toContain('outFields=PARCEL%2CACREAGE%2CTOTAL_ASSD%2CLAND_DOR_CODE%2CLIVING_AREA')
    expect(url).toContain('returnGeometry=true')
    expect(url).not.toContain('NAME1')
    expect(url).not.toContain('SITUS')
  })

  it('does not call a zero living area an unimproved parcel', () => {
    expect(normalizeOrangeParcelAttributes({ ACREAGE: '1.5', LIVING_AREA: 0 })).toEqual({
      lotSizeAcres: 1.5, lotSizeSqFt: 65_340, assessedValue: undefined, landUseCode: undefined, improved: undefined,
    })
  })
})
