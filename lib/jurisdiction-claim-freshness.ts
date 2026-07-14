import type {
  JurisdictionClaimRisk,
  JurisdictionClaimVolatility,
} from './jurisdiction-question-library'

export const JURISDICTION_FRESHNESS_POLICY_VERSION = '2026-07-14.v1' as const
export const LEGACY_UNCLASSIFIED_FRESHNESS_POLICY_VERSION = 'legacy-unclassified.v1' as const

export type ClaimVolatility = 'UNKNOWN' | JurisdictionClaimVolatility
export type ClaimFreshnessStatus = 'CURRENT' | 'REVIEW_DUE' | 'STALE'

const REVIEW_INTERVAL_DAYS: Record<JurisdictionClaimVolatility, number> = {
  STATIC: 365,
  ANNUAL: 300,
  QUARTERLY: 75,
  PER_SALE: 30,
}

const STALE_GRACE_DAYS: Record<JurisdictionClaimRisk, number> = {
  LOW: 90,
  MEDIUM: 60,
  HIGH: 30,
  CRITICAL: 0,
}

function addDays(value: Date, days: number): Date {
  return new Date(value.getTime() + days * 86_400_000)
}

export function calculateClaimFreshness(input: {
  volatility: ClaimVolatility
  risk: JurisdictionClaimRisk
  evidenceRetrievedAt: Date
}) {
  if (Number.isNaN(input.evidenceRetrievedAt.getTime())) {
    throw new Error('EVIDENCE_RETRIEVED_AT_INVALID')
  }
  if (input.volatility === 'UNKNOWN') {
    return {
      reviewDueAt: input.evidenceRetrievedAt,
      staleAt: input.evidenceRetrievedAt,
      policyVersion: LEGACY_UNCLASSIFIED_FRESHNESS_POLICY_VERSION,
    }
  }
  const reviewDueAt = addDays(input.evidenceRetrievedAt, REVIEW_INTERVAL_DAYS[input.volatility])
  return {
    reviewDueAt,
    staleAt: addDays(reviewDueAt, STALE_GRACE_DAYS[input.risk]),
    policyVersion: JURISDICTION_FRESHNESS_POLICY_VERSION,
  }
}

export function claimFreshnessStatus(input: {
  reviewDueAt: Date | string
  staleAt: Date | string
}, now = new Date()): ClaimFreshnessStatus {
  const reviewDueAt = input.reviewDueAt instanceof Date
    ? input.reviewDueAt
    : new Date(input.reviewDueAt)
  const staleAt = input.staleAt instanceof Date ? input.staleAt : new Date(input.staleAt)
  if (
    Number.isNaN(reviewDueAt.getTime()) ||
    Number.isNaN(staleAt.getTime()) ||
    Number.isNaN(now.getTime())
  ) {
    return 'STALE'
  }
  if (now.getTime() >= staleAt.getTime()) return 'STALE'
  if (now.getTime() >= reviewDueAt.getTime()) return 'REVIEW_DUE'
  return 'CURRENT'
}
