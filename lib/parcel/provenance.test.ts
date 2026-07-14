import { describe, expect, it } from 'vitest'
import { parcelFactProvenance } from './provenance'

const source = (provider: string) => ({ provider, retrievedAt: new Date(), ttlHours: 24 })

describe('parcel fact provenance', () => {
  it('distinguishes official, estimated, manual, unverified, and missing research facts', () => {
    expect(parcelFactProvenance('lotSizeSqFt', source('fl_dor'), 5_000)).toBe('OFFICIAL')
    expect(parcelFactProvenance('marketValueEstimate', source('regrid'), 100_000)).toBe('ESTIMATED')
    expect(parcelFactProvenance('zoning', source('manual'), 'R-4')).toBe('MANUAL')
    expect(parcelFactProvenance('lotSizeSqFt', source('regrid'), 5_000)).toBe('UNVERIFIED')
    expect(parcelFactProvenance('zoning', undefined, undefined)).toBe('MISSING')
  })
})
