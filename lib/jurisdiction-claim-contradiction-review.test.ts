import { beforeEach, describe, expect, it, vi } from 'vitest'

const { tx, transaction } = vi.hoisted(() => {
  const client = {
    extractionCandidate: { findFirst: vi.fn(), updateMany: vi.fn() },
    jurisdictionClaim: { findFirst: vi.fn() },
    jurisdictionClaimContradictionReview: { create: vi.fn() },
    $queryRaw: vi.fn(),
  }
  return {
    tx: client,
    transaction: vi.fn(async (callback: (value: typeof client) => Promise<unknown>) => callback(client)),
  }
})

vi.mock('./db', () => ({ db: { $transaction: transaction } }))

import { rejectJurisdictionCandidate } from './jurisdiction-claim-contradiction-review'

const candidateUpdatedAt = new Date('2026-07-14T03:00:00.000Z')
const reviewedAt = new Date('2026-07-14T04:00:00.000Z')
const contentHash = 'b'.repeat(64)
const candidate = {
  id: 'candidate-1',
  jurisdictionId: 'jurisdiction-1',
  section: 'zoning',
  fieldKey: 'minimumLotSizeSqft',
  extractedValue: { value: 8000, normalizedUnit: 'square_feet', confidence: 0.9 },
  updatedAt: candidateUpdatedAt,
  sourceUrlId: 'source-1',
  sourceSnippet: 'The minimum lot area is 8,000 square feet.',
  modelUsed: 'claude-test',
  evidenceSnapshot: {
    id: 'snapshot-1',
    jurisdictionId: 'jurisdiction-1',
    sourceUrlId: 'source-1',
    sourceUrl: 'https://county.example.gov/zoning',
    retrievedAt: new Date('2026-07-14T02:00:00.000Z'),
    retrievalAdapter: 'JINA_READER',
    representationMediaType: 'text/markdown; charset=utf-8',
    contentHash,
    storageKey: `jurisdiction-evidence/sha256/${contentHash.slice(0, 2)}/${contentHash}.md`,
    byteLength: 4096,
  },
}
const existingClaim = {
  id: 'claim-1',
  questionId: 'jurisdiction.2026-07-14.v2.zoning.minimumLotSizeSqft',
  questionSchemaVersion: '2026-07-14.v2',
  value: 7500,
  normalizedUnit: 'square_feet',
}
const baseInput = {
  candidateId: candidate.id,
  expectedCandidateUpdatedAt: candidateUpdatedAt,
  expectedCurrentClaimId: existingClaim.id,
  decision: 'REJECTED_CHALLENGE' as const,
  explanation: 'The challenging source applies to a different zoning district.',
  reviewerId: 'clerk-reviewer-1',
  reviewerLabel: 'reviewer@example.test',
  reviewedAt,
}

describe('jurisdiction candidate contradiction rejection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    tx.extractionCandidate.findFirst.mockResolvedValue(candidate)
    tx.$queryRaw.mockResolvedValue([{ currentClaimId: existingClaim.id }])
    tx.jurisdictionClaim.findFirst.mockResolvedValue(existingClaim)
    tx.extractionCandidate.updateMany.mockResolvedValue({ count: 1 })
    tx.jurisdictionClaimContradictionReview.create.mockResolvedValue({ id: 'review-1' })
  })

  it.each(['REJECTED_CHALLENGE', 'NOT_COMPARABLE'] as const)(
    'appends copied evidence for %s and rejects the pending challenge atomically',
    async decision => {
      const result = await rejectJurisdictionCandidate({ ...baseInput, decision })
      expect(tx.extractionCandidate.updateMany).toHaveBeenCalledWith({
        where: { id: candidate.id, status: 'PENDING', updatedAt: candidateUpdatedAt },
        data: { status: 'REJECTED', reviewedAt, reviewedBy: baseInput.reviewerLabel },
      })
      expect(tx.jurisdictionClaimContradictionReview.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          existingClaimId: existingClaim.id,
          existingValue: 7500,
          proposedValue: 8000,
          candidateReferenceId: candidate.id,
          evidenceSnapshotReferenceId: candidate.evidenceSnapshot.id,
          contentHash,
          decision,
          reviewedBy: baseInput.reviewerId,
        }),
        select: { id: true },
      })
      expect(result).toEqual({ reviewId: 'review-1', decision })
    },
  )

  it('allows an exact-version ordinary rejection when no active claim exists', async () => {
    tx.$queryRaw.mockResolvedValue([{ currentClaimId: null }])
    tx.jurisdictionClaim.findFirst.mockResolvedValue(null)
    const result = await rejectJurisdictionCandidate({
      candidateId: candidate.id,
      expectedCandidateUpdatedAt: candidateUpdatedAt,
      reviewerId: baseInput.reviewerId,
      reviewerLabel: baseInput.reviewerLabel,
      reviewedAt,
    })
    expect(result).toEqual({ reviewId: null, decision: 'REJECTED' })
    expect(tx.jurisdictionClaimContradictionReview.create).not.toHaveBeenCalled()
  })

  it('will not silently reject a contradiction without an outcome and explanation', async () => {
    await expect(rejectJurisdictionCandidate({
      candidateId: candidate.id,
      expectedCandidateUpdatedAt: candidateUpdatedAt,
      reviewerId: baseInput.reviewerId,
      reviewerLabel: baseInput.reviewerLabel,
    })).rejects.toThrow('CLAIM_CONTRADICTION_RESOLUTION_REQUIRED')
    await expect(rejectJurisdictionCandidate({ ...baseInput, explanation: 'short' }))
      .rejects.toThrow('CLAIM_CONTRADICTION_EXPLANATION_REQUIRED')
    expect(tx.extractionCandidate.updateMany).not.toHaveBeenCalled()
  })

  it('rejects stale candidate and current-claim versions before writes', async () => {
    tx.extractionCandidate.findFirst.mockResolvedValue(null)
    await expect(rejectJurisdictionCandidate(baseInput)).rejects.toThrow('CANDIDATE_NOT_PENDING')

    tx.extractionCandidate.findFirst.mockResolvedValue(candidate)
    tx.$queryRaw.mockResolvedValue([{ currentClaimId: 'newer-claim' }])
    tx.jurisdictionClaim.findFirst.mockResolvedValue(null)
    await expect(rejectJurisdictionCandidate(baseInput)).rejects.toThrow(
      'STALE_CLAIM_CONTRADICTION',
    )
    expect(tx.extractionCandidate.updateMany).not.toHaveBeenCalled()
  })

  it('rejects missing or mismatched snapshot evidence before writes', async () => {
    tx.extractionCandidate.findFirst.mockResolvedValue({ ...candidate, evidenceSnapshot: null })
    await expect(rejectJurisdictionCandidate(baseInput)).rejects.toThrow(
      'CLAIM_CONTRADICTION_EVIDENCE_REQUIRED',
    )
    expect(tx.extractionCandidate.updateMany).not.toHaveBeenCalled()
  })

  it('rejects evidence or candidate versions dated after the server review', async () => {
    tx.extractionCandidate.findFirst.mockResolvedValue({
      ...candidate,
      evidenceSnapshot: {
        ...candidate.evidenceSnapshot,
        retrievedAt: new Date(reviewedAt.getTime() + 1),
      },
    })
    await expect(rejectJurisdictionCandidate(baseInput)).rejects.toThrow(
      'EVIDENCE_RETRIEVED_AT_INVALID',
    )
    expect(tx.extractionCandidate.updateMany).not.toHaveBeenCalled()
  })

  it('rolls back if the candidate changes after the projection lock', async () => {
    tx.extractionCandidate.updateMany.mockResolvedValue({ count: 0 })
    await expect(rejectJurisdictionCandidate(baseInput)).rejects.toThrow('CANDIDATE_NOT_PENDING')
    expect(tx.jurisdictionClaimContradictionReview.create).not.toHaveBeenCalled()
  })
})
