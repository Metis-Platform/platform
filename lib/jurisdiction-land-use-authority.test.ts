import { describe, expect, it } from 'vitest'
import {
  COUNTY_WIDE_LAND_USE_AUTHORITY_SCOPE,
  resolveCountyLandUseAuthority,
  type CountyLandUseAuthorityClaim,
} from './jurisdiction-land-use-authority'
import { COUNTY_WIDE_LAND_USE_AUTHORITY_FIELD } from './jurisdiction-question-library'

const now = new Date('2026-07-20T12:00:00.000Z')

function claim(overrides: Partial<CountyLandUseAuthorityClaim> = {}): CountyLandUseAuthorityClaim {
  return {
    id: 'claim-1',
    section: 'zoning',
    fieldKey: COUNTY_WIDE_LAND_USE_AUTHORITY_FIELD,
    value: COUNTY_WIDE_LAND_USE_AUTHORITY_SCOPE,
    geographicScope: COUNTY_WIDE_LAND_USE_AUTHORITY_SCOPE,
    expectedAuthorityClass: 'LOCAL_OFFICIAL',
    sourceAuthorityClass: 'LOCAL_OFFICIAL',
    sourceAuthorityOwner: 'Example County Planning Department',
    sourceAuthorityStatus: 'VERIFIED',
    sourceAuthorityVerifiedAt: new Date('2026-07-01T00:00:00.000Z'),
    sourceAuthorityVerifiedBy: 'reviewer-1',
    verificationState: 'VERIFIED',
    reviewedAt: new Date('2026-07-01T00:00:00.000Z'),
    freshness: {
      reviewDueAt: new Date('2026-09-01T00:00:00.000Z'),
      staleAt: new Date('2026-09-01T00:00:00.000Z'),
    },
    evidence: [{
      sourceUrl: 'https://planning.example.gov/countywide-authority',
      sourceUrlRecord: {
        authorityClass: 'LOCAL_OFFICIAL',
        authorityOwner: 'Example County Planning Department',
        authorityStatus: 'VERIFIED',
        authorityVerifiedAt: new Date('2026-07-01T00:00:00.000Z'),
        authorityVerifiedBy: 'reviewer-1',
      },
    }],
    ...overrides,
  }
}

describe('county-wide land-use authority', () => {
  it('enables county rules only for a current, reviewed, source-backed county-wide declaration', () => {
    expect(resolveCountyLandUseAuthority([claim()], now)).toEqual({
      status: 'VERIFIED',
      claimId: 'claim-1',
      sourceUrl: 'https://planning.example.gov/countywide-authority',
      verifiedAt: '2026-07-01T00:00:00.000Z',
    })
  })

  it.each([
    ['a non-county-wide value', { value: 'UNINCORPORATED_ONLY' }],
    ['a non-county-wide geographic scope', { geographicScope: 'UNINCORPORATED_ONLY' }],
    ['an unverified claim', { verificationState: 'REVIEWED' }],
    ['a review-due claim', { freshness: { reviewDueAt: new Date('2026-07-15'), staleAt: new Date('2026-08-15') } }],
    ['a stale claim', { freshness: { reviewDueAt: new Date('2026-07-01'), staleAt: new Date('2026-07-15') } }],
    ['a rejected current source', { evidence: [{ sourceUrl: 'https://planning.example.gov/countywide-authority', sourceUrlRecord: { authorityClass: 'LOCAL_OFFICIAL', authorityOwner: 'Example County', authorityStatus: 'REJECTED', authorityVerifiedAt: new Date('2026-07-01'), authorityVerifiedBy: 'reviewer-1' } }] }],
    ['a missing current source projection', { evidence: [{ sourceUrl: 'https://planning.example.gov/countywide-authority', sourceUrlRecord: null }] }],
  ] as const)('fails closed for %s', (_reason, override) => {
    expect(resolveCountyLandUseAuthority([claim(override)], now)).toEqual({ status: 'UNRESOLVED' })
  })
})
