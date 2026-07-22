import { describe, expect, it, vi } from 'vitest'
import {
  fetchOfficialHarrisParcelFacts,
  harrisParcelQueryUrl,
  normalizeHarrisParcelAttributes,
} from './harris-property-appraiser'
import { OfficialParcelLocationError } from './volusia-property-appraiser'

const response = (payload: unknown, ok = true) => ({ ok, json: async () => payload }) as Response
const feature = {
  attributes: {
    HCAD_NUM: '0221090010009',
    acreage_1: 0.2752,
    land_sqft: 11_988,
    total_appraised_val: 77_920,
  },
}

describe('Harris Central Appraisal District parcel baseline', () => {
  it('returns only source-supported preliminary parcel facts', async () => {
    const facts = await fetchOfficialHarrisParcelFacts(
      { apn: '0221090010009', fipsCounty: '48201' },
      vi.fn().mockResolvedValue(response({ features: [feature] })),
    )

    expect(facts).toEqual({ lotSizeAcres: 0.2752, lotSizeSqFt: 11_988, assessedValue: 77_920 })
    expect(facts).not.toHaveProperty('marketValueEstimate')
    expect(facts).not.toHaveProperty('landUseCode')
    expect(facts).not.toHaveProperty('improved')
  })

  it('does not query outside Harris County and fails closed for invalid or ambiguous identifiers', async () => {
    const fetchImpl = vi.fn()
    await expect(fetchOfficialHarrisParcelFacts({ apn: '0221090010009', fipsCounty: '12127' }, fetchImpl)).resolves.toEqual({})
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(() => harrisParcelQueryUrl("1' OR 1=1")).toThrow(OfficialParcelLocationError)
    await expect(fetchOfficialHarrisParcelFacts(
      { apn: '0221090010009', fipsCounty: '48201' }, vi.fn().mockResolvedValue(response({ features: [feature, feature] })),
    )).rejects.toThrow('HARRIS_PARCEL_AMBIGUOUS')
  })

  it('requests only documented non-PII fields', () => {
    const url = harrisParcelQueryUrl('0221090010009')
    expect(url).toContain('outFields=HCAD_NUM%2Cacreage_1%2Cland_sqft%2Ctotal_appraised_val')
    expect(url).toContain('returnGeometry=false')
    expect(url).not.toContain('OWNER')
    expect(url).not.toContain('ADDRESS')
  })

  it('uses acreage only when square footage is absent', () => {
    expect(normalizeHarrisParcelAttributes({ acreage_1: '1.5' })).toEqual({
      lotSizeAcres: 1.5,
      lotSizeSqFt: 65_340,
      assessedValue: undefined,
    })
  })
})
