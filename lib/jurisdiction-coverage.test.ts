import { describe, expect, it } from 'vitest'
import {
  compareJurisdictionCoveragePriority,
  deriveJurisdictionLaunchTier,
  summarizeJurisdictionLaunchTiers,
  summarizeJurisdictionCoverage,
  type JurisdictionCoverageInput,
} from './jurisdiction-coverage'

const base: JurisdictionCoverageInput = {
  id: 'volusia', state: 'FL', county: 'Volusia', isAvailable: true,
  profile: null, activeClaims: [], pendingCandidates: [], verifiedSourceCount: 0,
  trackedPropertyCount: 0, researchRequestCount: 0, canonicalAcceptance: null,
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

  it('does not elevate stale, blocked, partial, or unauthoritative evidence above Tier C', () => {
    expect(deriveJurisdictionLaunchTier({
      criticalQuestionCount: 4, verifiedCurrentCriticalClaimCount: 3,
      verifiedSourceCount: 1, staleClaimCount: 0, blockedClaimCount: 0, canonicalAcceptance: null,
    })).toBe('TIER_C')
    expect(deriveJurisdictionLaunchTier({
      criticalQuestionCount: 4, verifiedCurrentCriticalClaimCount: 4,
      verifiedSourceCount: 1, staleClaimCount: 1, blockedClaimCount: 0, canonicalAcceptance: null,
    })).toBe('TIER_C')
    expect(deriveJurisdictionLaunchTier({
      criticalQuestionCount: 4, verifiedCurrentCriticalClaimCount: 4,
      verifiedSourceCount: 0, staleClaimCount: 0, blockedClaimCount: 0, canonicalAcceptance: null,
    })).toBe('TIER_C')
  })

  it('reports demand-weighted Tier B readiness without substituting county count for demand', () => {
    const tierB = { ...summarizeJurisdictionCoverage({ ...base, id: 'b', researchRequestCount: 1 }), launchTier: 'TIER_B' as const }
    const tierC = { ...summarizeJurisdictionCoverage({ ...base, id: 'c', trackedPropertyCount: 9 }), launchTier: 'TIER_C' as const }

    expect(summarizeJurisdictionLaunchTiers([tierB, tierC])).toMatchObject({
      tierACountyCount: 0, tierBCountyCount: 1, tierCCountyCount: 1,
      tierADemandCount: 0, tierBDemandCount: 1, tierCDemandCount: 9, tierAOrBDemandShare: 0.1, tierBDemandShare: 0.1,
    })
  })

  it('elevates only current passed canonical acceptance after Tier B is satisfied', () => {
    const tierB = {
      criticalQuestionCount: 4, verifiedCurrentCriticalClaimCount: 4,
      verifiedSourceCount: 1, staleClaimCount: 0, blockedClaimCount: 0,
    }
    expect(deriveJurisdictionLaunchTier({ ...tierB, canonicalAcceptance: {
      id: 'pass', result: 'PASSED', contractVersion: '2026-07-20.v1', evidenceUrl: 'https://evidence.example/pass', reviewedAt: new Date(),
    } })).toBe('TIER_A')
    expect(deriveJurisdictionLaunchTier({ ...tierB, canonicalAcceptance: {
      id: 'failed', result: 'FAILED', contractVersion: '2026-07-20.v1', evidenceUrl: 'https://evidence.example/fail', reviewedAt: new Date(),
    } })).toBe('TIER_B')
    expect(deriveJurisdictionLaunchTier({ ...tierB, canonicalAcceptance: {
      id: 'stale-contract', result: 'PASSED', contractVersion: '2026-01-01.v1', evidenceUrl: 'https://evidence.example/old', reviewedAt: new Date(),
    } })).toBe('TIER_B')
  })
})
