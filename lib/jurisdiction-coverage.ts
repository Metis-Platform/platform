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
  }

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
