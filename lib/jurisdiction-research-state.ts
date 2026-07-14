export type JurisdictionCoverageState =
  | 'UNKNOWN'
  | 'DISCOVERING'
  | 'PRELIMINARY'
  | 'REVIEW_REQUIRED'
  | 'VERIFIED'
  | 'STALE'
  | 'BLOCKED'

export function deriveJurisdictionCoverageState(input: {
  workStatus: 'DISCOVERING' | 'PAUSED' | null
  sourceCount: number
  requiredQuestionCount: number
  verifiedCurrentClaimCount: number
  staleClaimCount: number
  blockedClaimCount: number
  pendingCandidateCount: number
}): JurisdictionCoverageState {
  if (input.blockedClaimCount > 0 || input.workStatus === 'PAUSED') return 'BLOCKED'
  if (input.staleClaimCount > 0) return 'STALE'
  if (input.pendingCandidateCount > 0) return 'REVIEW_REQUIRED'
  if (
    input.requiredQuestionCount > 0 &&
    input.verifiedCurrentClaimCount === input.requiredQuestionCount
  ) return 'VERIFIED'
  if (input.sourceCount > 0) return 'PRELIMINARY'
  if (input.workStatus === 'DISCOVERING') return 'DISCOVERING'
  return 'UNKNOWN'
}
