import { claimFreshnessStatus } from './jurisdiction-claim-freshness'
import {
  claimValuesConflict,
  extractedClaimValue,
} from './jurisdiction-claim-contradiction'
import {
  JURISDICTION_PROFILE_SECTIONS,
  type JurisdictionProfileSection,
} from './jurisdiction-profile'
import {
  JURISDICTION_QUESTIONS,
  JURISDICTION_QUESTION_SCHEMA_VERSION,
  getJurisdictionQuestion,
} from './jurisdiction-question-library'

type ProfileField = { claimId?: unknown }

export type CoverageClaim = {
  id: string
  section: string
  fieldKey: string
  value: unknown
  normalizedUnit: string | null
  verificationState: string
  freshness: { reviewDueAt: Date; staleAt: Date } | null
}

export type CoverageCandidate = {
  section: string
  fieldKey: string
  extractedValue: unknown
}

export type JurisdictionCoverageRow = {
  id: string
  state: string
  county: string
  isAvailable: boolean
  claimBackedFieldCount: number
  legacyFieldCount: number
  invalidProjectionFieldCount: number
  criticalUntrustedFieldCount: number
  unmappedLegacyFieldCount: number
  catalogGapCount: number
  staleClaimCount: number
  blockedClaimCount: number
  pendingCandidateCount: number
  verifiedSourceCount: number
  trackedPropertyCount: number
  researchRequestCount: number
  criticalQuestionCount: number
  verifiedCurrentCriticalClaimCount: number
  canonicalAcceptance: CoverageCanonicalAcceptance | null
  launchTier: JurisdictionLaunchTier
}

export type CoverageCanonicalAcceptance = {
  id: string
  contractVersion: string
  evidenceUrl: string
  result: 'PASSED' | 'FAILED'
  reviewedAt: Date
}

export type JurisdictionLaunchTier = 'TIER_A' | 'TIER_B' | 'TIER_C'

export type JurisdictionLaunchTierSummary = {
  tierACountyCount: number
  tierBCountyCount: number
  tierCCountyCount: number
  tierADemandCount: number
  tierBDemandCount: number
  tierCDemandCount: number
  tierAOrBDemandShare: number | null
  tierBDemandShare: number | null
}

export type JurisdictionCoverageInput = {
  id: string
  state: string
  county: string
  isAvailable: boolean
  profile: Partial<Record<JurisdictionProfileSection, unknown>> | null
  activeClaims: CoverageClaim[]
  pendingCandidates: CoverageCandidate[]
  verifiedSourceCount: number
  trackedPropertyCount: number
  researchRequestCount: number
  canonicalAcceptance?: CoverageCanonicalAcceptance | null
  now?: Date
}

function fieldsIn(section: unknown): Array<[string, ProfileField]> {
  if (!section || typeof section !== 'object' || Array.isArray(section)) return []
  return Object.entries(section).map(([key, value]) => [
    key,
    value && typeof value === 'object' && !Array.isArray(value)
      ? value as ProfileField
      : {},
  ])
}

export function summarizeJurisdictionCoverage(
  input: JurisdictionCoverageInput,
): JurisdictionCoverageRow {
  const activeByField = new Map(
    input.activeClaims.map(claim => [`${claim.section}.${claim.fieldKey}`, claim]),
  )
  const trustedFields = new Set<string>()
  let legacyFieldCount = 0
  let invalidProjectionFieldCount = 0
  let criticalUntrustedFieldCount = 0
  let unmappedLegacyFieldCount = 0

  for (const section of JURISDICTION_PROFILE_SECTIONS) {
    for (const [fieldKey, field] of fieldsIn(input.profile?.[section])) {
      const key = `${section}.${fieldKey}`
      const claim = activeByField.get(key)
      if (typeof field.claimId === 'string' && claim?.id === field.claimId) {
        trustedFields.add(key)
        continue
      }

      if (field.claimId == null) legacyFieldCount += 1
      else invalidProjectionFieldCount += 1

      const question = getJurisdictionQuestion(section, fieldKey)
      if (!question) unmappedLegacyFieldCount += 1
      else if (question.risk === 'CRITICAL' || question.risk === 'HIGH') {
        criticalUntrustedFieldCount += 1
      }
    }
  }

  const now = input.now ?? new Date()
  let staleClaimCount = 0
  let blockedClaimCount = 0
  const criticalQuestionKeys = new Set(JURISDICTION_QUESTIONS
    .filter(question => question.risk === 'CRITICAL')
    .map(question => `${question.section}.${question.fieldKey}`))
  let verifiedCurrentCriticalClaimCount = 0
  for (const key of trustedFields) {
    const claim = activeByField.get(key)!
    if (
      claim.verificationState === 'BLOCKED' ||
      input.pendingCandidates.some(candidate =>
        `${candidate.section}.${candidate.fieldKey}` === key &&
        claimValuesConflict(claim, extractedClaimValue(candidate.extractedValue)),
      )
    ) blockedClaimCount += 1

    if (
      claim.verificationState === 'STALE' ||
      !claim.freshness ||
      claimFreshnessStatus(claim.freshness, now) === 'STALE'
    ) staleClaimCount += 1

    if (
      criticalQuestionKeys.has(key) &&
      claim.verificationState === 'VERIFIED' &&
      claim.freshness != null &&
      claimFreshnessStatus(claim.freshness, now) === 'CURRENT' &&
      !input.pendingCandidates.some(candidate =>
        `${candidate.section}.${candidate.fieldKey}` === key &&
        claimValuesConflict(claim, extractedClaimValue(candidate.extractedValue)),
      )
    ) verifiedCurrentCriticalClaimCount += 1
  }

  const launchTier = deriveJurisdictionLaunchTier({
    criticalQuestionCount: criticalQuestionKeys.size,
    verifiedCurrentCriticalClaimCount,
    verifiedSourceCount: input.verifiedSourceCount,
    staleClaimCount,
    blockedClaimCount,
    canonicalAcceptance: input.canonicalAcceptance ?? null,
  })

  return {
    id: input.id,
    state: input.state,
    county: input.county,
    isAvailable: input.isAvailable,
    claimBackedFieldCount: trustedFields.size,
    legacyFieldCount,
    invalidProjectionFieldCount,
    criticalUntrustedFieldCount,
    unmappedLegacyFieldCount,
    catalogGapCount: JURISDICTION_QUESTIONS.filter(
      question => !trustedFields.has(`${question.section}.${question.fieldKey}`),
    ).length,
    staleClaimCount,
    blockedClaimCount,
    pendingCandidateCount: input.pendingCandidates.length,
    verifiedSourceCount: input.verifiedSourceCount,
    trackedPropertyCount: input.trackedPropertyCount,
    researchRequestCount: input.researchRequestCount,
    criticalQuestionCount: criticalQuestionKeys.size,
    verifiedCurrentCriticalClaimCount,
    canonicalAcceptance: input.canonicalAcceptance ?? null,
    launchTier,
  }
}

export function deriveJurisdictionLaunchTier(input: {
  criticalQuestionCount: number
  verifiedCurrentCriticalClaimCount: number
  verifiedSourceCount: number
  staleClaimCount: number
  blockedClaimCount: number
  canonicalAcceptance: CoverageCanonicalAcceptance | null
}): JurisdictionLaunchTier {
  if (
    input.criticalQuestionCount > 0 &&
    input.verifiedCurrentCriticalClaimCount === input.criticalQuestionCount &&
    input.verifiedSourceCount > 0 &&
    input.staleClaimCount === 0 &&
    input.blockedClaimCount === 0
  ) {
    if (
      input.canonicalAcceptance?.result === 'PASSED' &&
      input.canonicalAcceptance.contractVersion === JURISDICTION_QUESTION_SCHEMA_VERSION
    ) return 'TIER_A'
    return 'TIER_B'
  }
  return 'TIER_C'
}

export function summarizeJurisdictionLaunchTiers(rows: JurisdictionCoverageRow[]): JurisdictionLaunchTierSummary {
  const tierARows = rows.filter(row => row.launchTier === 'TIER_A')
  const tierBRows = rows.filter(row => row.launchTier === 'TIER_B')
  const demand = (row: JurisdictionCoverageRow) => row.researchRequestCount + row.trackedPropertyCount
  const tierADemandCount = tierARows.reduce((sum, row) => sum + demand(row), 0)
  const tierBDemandCount = tierBRows.reduce((sum, row) => sum + demand(row), 0)
  const totalDemand = rows.reduce((sum, row) => sum + demand(row), 0)
  return {
    tierACountyCount: tierARows.length,
    tierBCountyCount: tierBRows.length,
    tierCCountyCount: rows.length - tierARows.length - tierBRows.length,
    tierADemandCount,
    tierBDemandCount,
    tierCDemandCount: totalDemand - tierADemandCount - tierBDemandCount,
    tierAOrBDemandShare: totalDemand === 0 ? null : (tierADemandCount + tierBDemandCount) / totalDemand,
    tierBDemandShare: totalDemand === 0 ? null : tierBDemandCount / totalDemand,
  }
}

/** Demand outranks registry availability and research debt; names break all ties. */
export function compareJurisdictionCoveragePriority(
  a: JurisdictionCoverageRow,
  b: JurisdictionCoverageRow,
): number {
  return (
    b.researchRequestCount - a.researchRequestCount ||
    b.trackedPropertyCount - a.trackedPropertyCount ||
    Number(b.isAvailable) - Number(a.isAvailable) ||
    b.blockedClaimCount - a.blockedClaimCount ||
    b.criticalUntrustedFieldCount - a.criticalUntrustedFieldCount ||
    a.state.localeCompare(b.state) ||
    a.county.localeCompare(b.county)
  )
}
