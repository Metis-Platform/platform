import { describe, expect, it } from 'vitest'
import { buildBidGates } from './bid-gates'

const parcel = {
  apn: '00414218000001860', apnRaw: '00414218000001860', fipsCounty: '12099',
  lotSizeSqFt: 50_094, frontageLinearFt: 209, lotDepthFt: 239, improved: false,
  zoning: 'AR', zoningDescription: 'AGRICULTURAL RESIDENTIAL', floodZone: 'X',
  dataCompleteness: 1, lastUpdated: new Date(), sources: {},
}

describe('bid research gates', () => {
  it('keeps the Palm Beach acceptance parcel in review instead of clearing or calling it unbuildable', () => {
    const gates = buildBidGates(parcel, 'UNRESOLVED')

    expect(gates).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'ZONING_BUILD', status: 'REVIEW_REQUIRED', evidence: expect.stringContaining('AR') }),
      expect.objectContaining({ key: 'FLOOD_WETLANDS', status: 'REVIEW_REQUIRED', evidence: expect.stringContaining('X') }),
      expect.objectContaining({ key: 'HOA_POA', status: 'REVIEW_REQUIRED' }),
      expect.objectContaining({ key: 'TITLE_TAX_DEED', status: 'REVIEW_REQUIRED' }),
    ]))
  })

  it('flags a mapped high-risk flood and wetlands combination', () => {
    const gates = buildBidGates({ ...parcel, floodZone: 'AE', wetlandsPresent: true }, 'VERIFIED')
    expect(gates.find(gate => gate.key === 'FLOOD_WETLANDS')).toMatchObject({ status: 'FLAGGED' })
  })
})
