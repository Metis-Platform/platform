import { describe, expect, it } from 'vitest'
import { parcelFactProvenance, parcelFactTimestampLabel } from './provenance'

const source = (provider: string) => ({ provider, retrievedAt: new Date('2026-07-18T12:00:00.000Z'), ttlHours: 24 })

describe('parcel fact provenance', () => {
  it('distinguishes official, estimated, manual, unverified, and missing research facts', () => {
    expect(parcelFactProvenance('lotSizeSqFt', source('volusia_property_appraiser'), 5_000)).toBe('OFFICIAL')
    expect(parcelFactProvenance('marketValueEstimate', source('regrid'), 100_000)).toBe('ESTIMATED')
    expect(parcelFactProvenance('elevationFeet', source('usgs_3dep'), 46.9)).toBe('OFFICIAL')
    expect(parcelFactProvenance('zoning', source('manual'), 'R-4')).toBe('MANUAL')
    expect(parcelFactProvenance('lotSizeSqFt', source('regrid'), 5_000)).toBe('UNVERIFIED')
    expect(parcelFactProvenance('lotSizeSqFt', source('fl_dor'), 5_000)).toBe('UNVERIFIED')
    expect(parcelFactProvenance('zoning', undefined, undefined)).toBe('MISSING')
  })

  it('labels source retrieval and manual recording dates without inventing freshness', () => {
    expect(parcelFactTimestampLabel(source('fema_nfhl'))).toBe('Retrieved 2026-07-18')
    expect(parcelFactTimestampLabel(source('manual'))).toBe('Recorded 2026-07-18')
    expect(parcelFactTimestampLabel({ provider: 'fema_nfhl', retrievedAt: new Date('invalid'), ttlHours: 24 })).toBeUndefined()
  })
})
