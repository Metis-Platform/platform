import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getJurisdictionQuestion } from './jurisdiction-question-library'

const { tx, transaction } = vi.hoisted(() => {
  const client = {
    jurisdictionClaim: { findUnique: vi.fn() },
    jurisdictionEvidenceSnapshot: { findFirst: vi.fn() },
    jurisdictionSourceUrl: { findFirst: vi.fn() },
    jurisdictionClaimFreshness: { updateMany: vi.fn() },
    jurisdictionClaimReReview: { create: vi.fn() },
    $executeRaw: vi.fn(),
  }
  return {
    tx: client,
    transaction: vi.fn(async (callback: (value: typeof client) => Promise<unknown>) => callback(client)),
  }
})

vi.mock('./db', () => ({ db: { $transaction: transaction } }))

import { reReviewJurisdictionClaim } from './jurisdiction-claim-re-review'
import { JURISDICTION_FRESHNESS_POLICY_VERSION } from './jurisdiction-claim-freshness'

const question = getJurisdictionQuestion('zoning', 'minimumLotSizeSqft')!
const expectedUpdatedAt = new Date('2026-07-14T01:00:00.000Z')
const priorRetrievedAt = new Date('2026-01-01T00:00:00.000Z')
const snapshotRetrievedAt = new Date('2026-07-13T20:00:00.000Z')
const reviewedAt = new Date('2026-07-14T02:00:00.000Z')
const contentHash = 'a'.repeat(64)
const storageKey = `jurisdiction-evidence/sha256/aa/${contentHash}.md`
const freshness = {
  claimId: 'claim-1',
  lastEvidenceSnapshotId: 'snapshot-old',
  lastEvidenceRetrievedAt: priorRetrievedAt,
  reviewDueAt: new Date('2026-06-01T00:00:00.000Z'),
  staleAt: new Date('2026-06-01T00:00:00.000Z'),
  policyVersion: 'prior-policy',
  createdAt: priorRetrievedAt,
  updatedAt: expectedUpdatedAt,
}
const claim = {
  id: 'claim-1',
  jurisdictionId: 'jurisdiction-1',
  questionId: question.id,
  section: question.section,
  fieldKey: question.fieldKey,
  risk: question.risk,
  volatility: 'ANNUAL' as const,
  supersededByClaim: null,
  freshness,
  evidence: [{ sourceUrlId: 'source-1', contentHash }],
}
const snapshot = {
  id: 'snapshot-new',
  sourceUrlId: 'source-1',
  sourceUrl: 'https://county.example.gov/zoning',
  retrievedAt: snapshotRetrievedAt,
  retrievalAdapter: 'JINA_READER' as const,
  representationMediaType: 'text/markdown; charset=utf-8',
  contentHash,
  storageKey,
  byteLength: 4096,
}
const input = {
  claimId: claim.id,
  evidenceSnapshotId: snapshot.id,
  expectedFreshnessUpdatedAt: expectedUpdatedAt,
  explanation: 'The newer retrieval is unchanged and still authoritative.',
  reviewerId: 'clerk-reviewer-1',
  reviewedAt,
}

describe('jurisdiction claim re-review', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    tx.jurisdictionClaim.findUnique.mockResolvedValue(claim)
    tx.jurisdictionEvidenceSnapshot.findFirst.mockResolvedValue(snapshot)
    tx.jurisdictionSourceUrl.findFirst.mockResolvedValue({ authorityStatus: 'VERIFIED' })
    tx.jurisdictionClaimFreshness.updateMany.mockResolvedValue({ count: 1 })
    tx.jurisdictionClaimReReview.create.mockResolvedValue({ id: 're-review-1' })
    tx.$executeRaw.mockResolvedValue(1)
  })

  it('atomically appends copied evidence, advances freshness, and updates the current projection', async () => {
    const result = await reReviewJurisdictionClaim(input)

    expect(transaction).toHaveBeenCalledTimes(1)
    expect(tx.jurisdictionEvidenceSnapshot.findFirst).toHaveBeenCalledWith({
      where: {
        id: snapshot.id,
        jurisdictionId: claim.jurisdictionId,
        retrievedAt: { gt: priorRetrievedAt },
      },
      select: expect.any(Object),
    })
    expect(tx.jurisdictionClaimFreshness.updateMany).toHaveBeenCalledWith({
      where: { claimId: claim.id, updatedAt: expectedUpdatedAt },
      data: expect.objectContaining({
        lastEvidenceSnapshotId: snapshot.id,
        lastEvidenceRetrievedAt: snapshotRetrievedAt,
        policyVersion: JURISDICTION_FRESHNESS_POLICY_VERSION,
      }),
    })
    expect(tx.jurisdictionClaimReReview.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        claimId: claim.id,
        evidenceSnapshotId: snapshot.id,
        sourceUrl: snapshot.sourceUrl,
        contentHash,
        storageKey,
        explanation: input.explanation,
        reviewedAt,
        reviewedBy: input.reviewerId,
      }),
      select: { id: true },
    })
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1)
    expect(result.reReviewId).toBe('re-review-1')
  })

  it('requires server reviewer, explanation, and exact version before a transaction', async () => {
    await expect(reReviewJurisdictionClaim({ ...input, reviewerId: ' ' }))
      .rejects.toThrow('REVIEWER_REQUIRED')
    await expect(reReviewJurisdictionClaim({ ...input, explanation: 'short' }))
      .rejects.toThrow('EXPLANATION_REQUIRED')
    await expect(reReviewJurisdictionClaim({
      ...input,
      expectedFreshnessUpdatedAt: new Date('bad'),
    })).rejects.toThrow('EXPECTED_VERSION_REQUIRED')
    expect(transaction).not.toHaveBeenCalled()
  })

  it('rejects superseded and stale claim pages before writes', async () => {
    tx.jurisdictionClaim.findUnique.mockResolvedValue({
      ...claim,
      supersededByClaim: { id: 'replacement-claim' },
    })
    await expect(reReviewJurisdictionClaim(input)).rejects.toThrow('CLAIM_SUPERSEDED')

    tx.jurisdictionClaim.findUnique.mockResolvedValue({
      ...claim,
      freshness: { ...freshness, updatedAt: new Date('2026-07-14T01:30:00.000Z') },
    })
    await expect(reReviewJurisdictionClaim(input)).rejects.toThrow('STALE_CLAIM_REVIEW')
    expect(tx.jurisdictionClaimFreshness.updateMany).not.toHaveBeenCalled()
  })

  it('rejects missing, old, and changed evidence', async () => {
    tx.jurisdictionEvidenceSnapshot.findFirst.mockResolvedValue(null)
    await expect(reReviewJurisdictionClaim(input)).rejects.toThrow('EVIDENCE_SNAPSHOT_NOT_NEWER')

    tx.jurisdictionEvidenceSnapshot.findFirst.mockResolvedValue({
      ...snapshot,
      contentHash: 'b'.repeat(64),
      storageKey: `jurisdiction-evidence/sha256/bb/${'b'.repeat(64)}.md`,
    })
    await expect(reReviewJurisdictionClaim(input)).rejects.toThrow(
      'EVIDENCE_CHANGED_REVIEW_REQUIRED',
    )
    expect(tx.jurisdictionClaimFreshness.updateMany).not.toHaveBeenCalled()
  })

  it('rejects evidence with a retrieval time after the server review time', async () => {
    tx.jurisdictionEvidenceSnapshot.findFirst.mockResolvedValue({
      ...snapshot,
      retrievedAt: new Date(reviewedAt.getTime() + 1),
    })
    await expect(reReviewJurisdictionClaim(input)).rejects.toThrow(
      'EVIDENCE_RETRIEVED_AT_INVALID',
    )
  })

  it('rejects a source that is currently rejected', async () => {
    tx.jurisdictionSourceUrl.findFirst.mockResolvedValue({ authorityStatus: 'REJECTED' })
    await expect(reReviewJurisdictionClaim(input)).rejects.toThrow('SOURCE_REJECTED')
    expect(tx.jurisdictionClaimReReview.create).not.toHaveBeenCalled()
  })

  it('does not fabricate a policy for legacy unclassified claims', async () => {
    tx.jurisdictionClaim.findUnique.mockResolvedValue({ ...claim, risk: 'UNKNOWN' })
    await expect(reReviewJurisdictionClaim(input)).rejects.toThrow(
      'CLAIM_RISK_UNCLASSIFIED',
    )

    tx.jurisdictionClaim.findUnique.mockResolvedValue({ ...claim, volatility: 'UNKNOWN' })
    await expect(reReviewJurisdictionClaim(input)).rejects.toThrow(
      'CLAIM_VOLATILITY_UNCLASSIFIED',
    )
  })

  it('fails atomically on concurrent projection or freshness drift', async () => {
    tx.jurisdictionClaimFreshness.updateMany.mockResolvedValue({ count: 0 })
    await expect(reReviewJurisdictionClaim(input)).rejects.toThrow('STALE_CLAIM_REVIEW')

    tx.jurisdictionClaimFreshness.updateMany.mockResolvedValue({ count: 1 })
    tx.$executeRaw.mockResolvedValue(0)
    await expect(reReviewJurisdictionClaim(input)).rejects.toThrow('CLAIM_NOT_CURRENT')
  })
})
