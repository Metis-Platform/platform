import { describe, expect, it } from 'vitest'
import { calculateParcelCompleteness } from './profile'

describe('calculateParcelCompleteness', () => {
  it('scores only issue #230 hard parcel fields', () => {
    expect(calculateParcelCompleteness({
      lotSizeSqFt: 5000,
      zoning: 'R-1',
      floodZone: 'X',
      improved: false,
      irsLienPresent: false,
      bankruptcyStay: false,
    })).toBe(1)
  })

  it('treats explicit false hard fields as complete', () => {
    expect(calculateParcelCompleteness({
      improved: false,
      irsLienPresent: false,
      bankruptcyStay: false,
    })).toBe(0.5)
  })
})
