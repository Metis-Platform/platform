import { describe, expect, it } from 'vitest'
import { deriveJurisdictionCoverageState } from './jurisdiction-research-state'

const base = { workStatus: null, sourceCount: 0, requiredQuestionCount: 4, verifiedCurrentClaimCount: 0, staleClaimCount: 0, blockedClaimCount: 0, pendingCandidateCount: 0 } as const

describe('jurisdiction coverage state', () => {
  it('fails closed for blocked, stale, and pending review before declaring progress', () => {
    expect(deriveJurisdictionCoverageState({ ...base, workStatus: 'DISCOVERING', blockedClaimCount: 1 })).toBe('BLOCKED')
    expect(deriveJurisdictionCoverageState({ ...base, sourceCount: 1, staleClaimCount: 1 })).toBe('STALE')
    expect(deriveJurisdictionCoverageState({ ...base, sourceCount: 1, pendingCandidateCount: 1 })).toBe('REVIEW_REQUIRED')
  })

  it('requires every required evidence-backed claim before verified', () => {
    expect(deriveJurisdictionCoverageState({ ...base, sourceCount: 1, verifiedCurrentClaimCount: 3 })).toBe('PRELIMINARY')
    expect(deriveJurisdictionCoverageState({ ...base, sourceCount: 1, verifiedCurrentClaimCount: 4 })).toBe('VERIFIED')
  })

  it('keeps unstarted work unknown and paused work blocked', () => {
    expect(deriveJurisdictionCoverageState(base)).toBe('UNKNOWN')
    expect(deriveJurisdictionCoverageState({ ...base, workStatus: 'DISCOVERING' })).toBe('DISCOVERING')
    expect(deriveJurisdictionCoverageState({ ...base, workStatus: 'PAUSED', sourceCount: 1 })).toBe('BLOCKED')
  })
})
