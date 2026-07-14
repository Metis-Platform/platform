import { describe, expect, it } from 'vitest'
import {
  compareJurisdictionCoveragePriority,
  summarizeJurisdictionCoverage,
  type JurisdictionCoverageInput,
} from './jurisdiction-coverage'

const base: JurisdictionCoverageInput = {
  id: 'volusia', state: 'FL', county: 'Volusia', isAvailable: true,
  profile: null, activeClaims: [], pendingCandidates: [], verifiedSourceCount: 0,
  trackedPropertyCount: 0, researchRequestCount: 0,
  now: new Date('2026-07-13T00:00:00.000Z'),
}

describe('jurisdiction coverage', () => {
  it('separates legacy, invalid, exact claim-backed, and unmapped fields', () => {
    const row = summarizeJurisdictionCoverage({
      ...base,
      profile: { taxSale: {
        saleType: { value: 'deed' },
        bidFormat: { value: 'auction', claimId: 'missing' },
        mystery: { value: true },
        redemptionPeriodMonths: { value: 24, claimId: 'current' },
      } },
      activeClaims: [{
        id: 'current', section: 'taxSale', fieldKey: 'redemptionPeriodMonths',
        value: 24, normalizedUnit: 'months', verificationState: 'REVIEWED',
        freshness: {
          reviewDueAt: new Date('2026-08-01T00:00:00.000Z'),
          staleAt: new Date('2026-09-01T00:00:00.000Z'),
        },
      }],
    })

    expect(row).toMatchObject({
      claimBackedFieldCount: 1,
      legacyFieldCount: 2,
      invalidProjectionFieldCount: 1,
      criticalUntrustedFieldCount: 2,
      unmappedLegacyFieldCount: 1,
      staleClaimCount: 0,
    })
  })

  it('counts missing freshness and contradictory pending evidence as unsafe', () => {
    const row = summarizeJurisdictionCoverage({
      ...base,
      profile: { taxSale: { saleType: { value: 'deed', claimId: 'current' } } },
      activeClaims: [{
        id: 'current', section: 'taxSale', fieldKey: 'saleType', value: 'deed',
        normalizedUnit: null, verificationState: 'REVIEWED', freshness: null,
      }],
      pendingCandidates: [{
        section: 'taxSale', fieldKey: 'saleType', extractedValue: { value: 'lien' },
      }],
    })

    expect(row.staleClaimCount).toBe(1)
    expect(row.blockedClaimCount).toBe(1)
  })

  it('orders research requests before property demand and availability', () => {
    const requested = summarizeJurisdictionCoverage({ ...base, id: 'a', researchRequestCount: 1 })
    const tracked = summarizeJurisdictionCoverage({ ...base, id: 'b', trackedPropertyCount: 10 })
    const available = summarizeJurisdictionCoverage({ ...base, id: 'c', isAvailable: true })

    expect([available, tracked, requested].sort(compareJurisdictionCoveragePriority).map(row => row.id))
      .toEqual(['a', 'b', 'c'])
  })
})
