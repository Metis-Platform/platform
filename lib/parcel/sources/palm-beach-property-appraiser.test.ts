import { describe, expect, it, vi } from 'vitest'
import {
  fetchOfficialPalmBeachParcelFacts,
  normalizePalmBeachParcelModel,
  palmBeachParcelQueryUrl,
} from './palm-beach-property-appraiser'

const model = {
  propertyDetail: {
    Acres: '1.15', SqFt: '0', UseCode: '0000', UseCodeDesc: 'VACANT', Zoning: 'AR',
    ZoningDesc: 'AGRICULTURAL RESIDENTIAL', TaxYear: '2025',
  },
  assessmentInfo: [{ AssessedValue: '92060', TaxYear: '2025' }],
  appraisalInfo: [{ ImprovementValue: '0', TotalMarketValue: '182850', TaxYear: '2025' }],
  landDetails: [{ Front: '209', Depth: '239', Zoning: 'AR', Acres: '1.15', SqFt: '50094' }],
}

describe('Palm Beach County Property Appraiser parcel baseline', () => {
  it('normalizes source-supported facts without collecting owner information', () => {
    expect(normalizePalmBeachParcelModel(model)).toEqual({
      lotSizeAcres: 1.15,
      lotSizeSqFt: 50_094,
      frontageLinearFt: 209,
      lotDepthFt: 239,
      landUseCode: 'VACANT',
      improved: false,
      zoning: 'AR',
      zoningDescription: 'AGRICULTURAL RESIDENTIAL',
      assessedValue: 92_060,
      assessedYear: 2025,
      marketValueEstimate: 182_850,
    })
  })

  it('reads the public assessor page and retains only the supported parcel facts', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => `<script>var model = ${JSON.stringify(model)}; $.ajax({});</script>`,
    } as Response)

    await expect(fetchOfficialPalmBeachParcelFacts({
      apn: '00414218000001860', fipsCounty: '12099',
    }, fetchImpl)).resolves.toMatchObject({
      lotSizeSqFt: 50_094, frontageLinearFt: 209, lotDepthFt: 239, improved: false, zoning: 'AR',
    })
    expect(fetchImpl).toHaveBeenCalledWith(expect.stringContaining('parcelId=00414218000001860'), expect.anything())
  })

  it('fails closed for unsupported identifiers and unavailable source pages', async () => {
    expect(() => palmBeachParcelQueryUrl("1' OR 1=1")).toThrow('PALM_BEACH_PARCEL_IDENTIFIER_INVALID')
    await expect(fetchOfficialPalmBeachParcelFacts(
      { apn: '00414218000001860', fipsCounty: '12099' }, vi.fn().mockResolvedValue({ ok: false } as Response),
    )).rejects.toThrow('PALM_BEACH_PARCEL_SOURCE_UNAVAILABLE')
  })
})
