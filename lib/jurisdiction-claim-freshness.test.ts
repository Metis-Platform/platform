import { describe, expect, it } from 'vitest'
import {
  calculateClaimFreshness,
  claimFreshnessStatus,
  JURISDICTION_FRESHNESS_POLICY_VERSION,
  LEGACY_UNCLASSIFIED_FRESHNESS_POLICY_VERSION,
  type ClaimVolatility,
} from './jurisdiction-claim-freshness'
import type { JurisdictionClaimRisk } from './jurisdiction-question-library'

const start = new Date('2026-01-01T00:00:00.000Z')

describe('versioned jurisdiction claim freshness policy', () => {
  it.each([
    ['STATIC', 365],
    ['ANNUAL', 300],
    ['QUARTERLY', 75],
    ['PER_SALE', 30],
  ] as const)('%s claims become review-due after %d days', (volatility, days) => {
    const result = calculateClaimFreshness({ volatility, risk: 'LOW', evidenceRetrievedAt: start })
    expect(result.reviewDueAt.getTime()).toBe(start.getTime() + days * 86_400_000)
    expect(result.policyVersion).toBe(JURISDICTION_FRESHNESS_POLICY_VERSION)
  })

  it.each([
    ['LOW', 90],
    ['MEDIUM', 60],
    ['HIGH', 30],
    ['CRITICAL', 0],
  ] as const)('%s risk receives a %d-day stale grace', (risk, days) => {
    const result = calculateClaimFreshness({
      volatility: 'QUARTERLY',
      risk,
      evidenceRetrievedAt: start,
    })
    expect(result.staleAt.getTime()).toBe(result.reviewDueAt.getTime() + days * 86_400_000)
  })

  it('makes legacy unknown claims immediately stale without fabricated freshness', () => {
    const result = calculateClaimFreshness({
      volatility: 'UNKNOWN',
      risk: 'LOW',
      evidenceRetrievedAt: start,
    })
    expect(result).toEqual({
      reviewDueAt: start,
      staleAt: start,
      policyVersion: LEGACY_UNCLASSIFIED_FRESHNESS_POLICY_VERSION,
    })
    expect(claimFreshnessStatus(result, start)).toBe('STALE')
  })

  it('uses exact review-due and stale boundaries and fails closed on invalid dates', () => {
    const dates = calculateClaimFreshness({
      volatility: 'QUARTERLY',
      risk: 'HIGH',
      evidenceRetrievedAt: start,
    })
    expect(claimFreshnessStatus(dates, new Date(dates.reviewDueAt.getTime() - 1))).toBe('CURRENT')
    expect(claimFreshnessStatus(dates, dates.reviewDueAt)).toBe('REVIEW_DUE')
    expect(claimFreshnessStatus(dates, new Date(dates.staleAt.getTime() - 1))).toBe('REVIEW_DUE')
    expect(claimFreshnessStatus(dates, dates.staleAt)).toBe('STALE')
    expect(claimFreshnessStatus({ reviewDueAt: 'bad', staleAt: 'bad' }, start)).toBe('STALE')
  })

  it('covers every declared volatility and risk combination', () => {
    const volatilities: ClaimVolatility[] = ['STATIC', 'ANNUAL', 'QUARTERLY', 'PER_SALE']
    const risks: JurisdictionClaimRisk[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
    for (const volatility of volatilities) {
      for (const risk of risks) {
        expect(calculateClaimFreshness({ volatility, risk, evidenceRetrievedAt: start }).staleAt)
          .toBeInstanceOf(Date)
      }
    }
  })
})
