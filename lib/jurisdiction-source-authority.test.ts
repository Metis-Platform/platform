import { beforeEach, describe, expect, it, vi } from 'vitest'

const { tx, transaction } = vi.hoisted(() => {
  const client = {
    jurisdictionSourceUrl: { findUnique: vi.fn(), updateMany: vi.fn() },
    jurisdictionSourceAuthorityReview: { create: vi.fn() },
    jurisdictionClaim: { updateMany: vi.fn() },
  }
  return {
    tx: client,
    transaction: vi.fn(async (callback: (value: typeof client) => Promise<unknown>) => callback(client)),
  }
})

vi.mock('./db', () => ({ db: { $transaction: transaction } }))

import {
  reviewJurisdictionSourceAuthority,
  sourceAuthorityReviewSchema,
} from './jurisdiction-source-authority'

const sourceUpdatedAt = new Date('2026-07-14T00:50:00.000Z')
const reviewedAt = new Date('2026-07-14T01:00:00.000Z')
const source = {
  id: 'source-1',
  jurisdictionId: 'jurisdiction-1',
  url: 'https://county.example.gov/planning',
  officeType: 'planning_zoning',
  lastContentHash: 'source-content-hash',
  updatedAt: sourceUpdatedAt,
}
const verifiedBody = {
  decision: 'VERIFIED' as const,
  expectedUpdatedAt: sourceUpdatedAt.toISOString(),
  authorityClass: 'LOCAL_OFFICIAL' as const,
  authorityOwner: 'Example County Planning Department',
  evidenceUrl: 'https://county.example.gov/about/planning',
  explanation: 'The county directory identifies this department as the zoning authority.',
}

describe('source authority review validation', () => {
  it('requires complete authority evidence for verification', () => {
    expect(sourceAuthorityReviewSchema.safeParse(verifiedBody).success).toBe(true)
    expect(sourceAuthorityReviewSchema.safeParse({
      decision: 'VERIFIED',
      expectedUpdatedAt: sourceUpdatedAt.toISOString(),
      authorityClass: 'LOCAL_OFFICIAL',
      authorityOwner: 'Example County',
      explanation: 'Missing the required authority evidence URL.',
    }).success).toBe(false)
    expect(sourceAuthorityReviewSchema.safeParse({
      ...verifiedBody,
      evidenceUrl: 'javascript:alert(1)',
    }).success).toBe(false)
  })

  it('requires explanations for rejection/reset and strips hostile provenance', () => {
    expect(sourceAuthorityReviewSchema.safeParse({
      decision: 'REJECTED',
      expectedUpdatedAt: sourceUpdatedAt.toISOString(),
      explanation: 'too short',
    }).success).toBe(false)

    const parsed = sourceAuthorityReviewSchema.parse({
      ...verifiedBody,
      reviewedAt: '1999-01-01T00:00:00.000Z',
      reviewedBy: 'untrusted-client',
      sourceUrl: 'https://attacker.example',
    })
    expect(parsed).not.toHaveProperty('reviewedAt')
    expect(parsed).not.toHaveProperty('reviewedBy')
    expect(parsed).not.toHaveProperty('sourceUrl')
  })
})

describe('atomic source authority review', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    tx.jurisdictionSourceUrl.findUnique.mockResolvedValue(source)
    tx.jurisdictionSourceUrl.updateMany.mockResolvedValue({ count: 1 })
    tx.jurisdictionSourceAuthorityReview.create.mockResolvedValue({
      id: 'review-1',
      decision: 'VERIFIED',
    })
  })

  it('updates the current projection and appends the decision in one transaction', async () => {
    const review = sourceAuthorityReviewSchema.parse(verifiedBody)
    await reviewJurisdictionSourceAuthority({
      sourceId: source.id,
      review,
      reviewerId: 'clerk-reviewer-1',
      reviewedAt,
    })

    expect(transaction).toHaveBeenCalledTimes(1)
    expect(tx.jurisdictionSourceUrl.updateMany).toHaveBeenCalledWith({
      where: { id: source.id, updatedAt: sourceUpdatedAt },
      data: {
        authorityStatus: 'VERIFIED',
        authorityClass: 'LOCAL_OFFICIAL',
        authorityOwner: 'Example County Planning Department',
        authorityVerifiedAt: reviewedAt,
        authorityVerifiedBy: 'clerk-reviewer-1',
      },
    })
    expect(tx.jurisdictionSourceAuthorityReview.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        jurisdictionId: source.jurisdictionId,
        sourceUrlId: source.id,
        sourceUrl: source.url,
        sourceContentHash: source.lastContentHash,
        sourceUpdatedAt,
        evidenceUrl: verifiedBody.evidenceUrl,
        reviewedAt,
        reviewedBy: 'clerk-reviewer-1',
      }),
    })
    expect(tx.jurisdictionClaim.updateMany).not.toHaveBeenCalled()
  })

  it('clears the mutable authority projection when a source is rejected', async () => {
    const review = sourceAuthorityReviewSchema.parse({
      decision: 'REJECTED',
      expectedUpdatedAt: sourceUpdatedAt.toISOString(),
      explanation: 'This URL is a private aggregator, not the responsible government office.',
    })
    await reviewJurisdictionSourceAuthority({
      sourceId: source.id,
      review,
      reviewerId: 'clerk-reviewer-1',
      reviewedAt,
    })

    expect(tx.jurisdictionSourceUrl.updateMany).toHaveBeenCalledWith({
      where: { id: source.id, updatedAt: sourceUpdatedAt },
      data: {
        authorityStatus: 'REJECTED',
        authorityClass: null,
        authorityOwner: null,
        authorityVerifiedAt: null,
        authorityVerifiedBy: null,
      },
    })
    expect(tx.jurisdictionSourceAuthorityReview.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        decision: 'REJECTED',
        authorityClass: null,
        authorityOwner: null,
        evidenceUrl: null,
      }),
    })
  })

  it('rejects a stale page version before either write', async () => {
    const review = sourceAuthorityReviewSchema.parse({
      ...verifiedBody,
      expectedUpdatedAt: '2026-07-14T00:40:00.000Z',
    })
    await expect(reviewJurisdictionSourceAuthority({
      sourceId: source.id,
      review,
      reviewerId: 'clerk-reviewer-1',
    })).rejects.toThrow('STALE_SOURCE')
    expect(tx.jurisdictionSourceUrl.updateMany).not.toHaveBeenCalled()
    expect(tx.jurisdictionSourceAuthorityReview.create).not.toHaveBeenCalled()
  })

  it('aborts if the source changes during the transaction', async () => {
    tx.jurisdictionSourceUrl.updateMany.mockResolvedValue({ count: 0 })
    const review = sourceAuthorityReviewSchema.parse(verifiedBody)
    await expect(reviewJurisdictionSourceAuthority({
      sourceId: source.id,
      review,
      reviewerId: 'clerk-reviewer-1',
    })).rejects.toThrow('STALE_SOURCE')
    expect(tx.jurisdictionSourceAuthorityReview.create).not.toHaveBeenCalled()
  })

  it('requires a server reviewer identity before opening a transaction', async () => {
    const review = sourceAuthorityReviewSchema.parse(verifiedBody)
    await expect(reviewJurisdictionSourceAuthority({
      sourceId: source.id,
      review,
      reviewerId: ' ',
    })).rejects.toThrow('REVIEWER_REQUIRED')
    expect(transaction).not.toHaveBeenCalled()
  })
})
