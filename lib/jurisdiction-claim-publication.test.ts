import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getJurisdictionQuestion } from './jurisdiction-question-library'

const { tx, transaction } = vi.hoisted(() => {
  const client = {
    jurisdictionProfile: { upsert: vi.fn() },
    jurisdictionClaim: { findFirst: vi.fn(), create: vi.fn() },
    jurisdictionClaimEvidence: { create: vi.fn() },
    jurisdictionSourceUrl: { findFirst: vi.fn() },
    extractionCandidate: { updateMany: vi.fn() },
    $queryRaw: vi.fn(),
  }
  return {
    tx: client,
    transaction: vi.fn(async (callback: (value: typeof client) => Promise<unknown>) => callback(client)),
  }
})

vi.mock('./db', () => ({ db: { $transaction: transaction } }))

import {
  buildClaimPublication,
  claimVerificationState,
  publishJurisdictionClaim,
} from './jurisdiction-claim-publication'

const question = getJurisdictionQuestion('zoning', 'minimumLotSizeSqft')!
const reviewedAt = new Date('2026-07-14T00:30:00.000Z')
const source = {
  sourceUrlId: 'source-1',
  candidateId: 'candidate-1',
  url: 'https://county.example.gov/zoning',
  snippet: 'Minimum lot area is 7,500 square feet.',
  retrievedAt: new Date('2026-07-13T23:00:00.000Z'),
  contentHash: 'content-sha256',
  modelUsed: 'claude-test',
  authorityClass: question.expectedAuthority,
  authorityOwner: 'Example County Planning Department',
  authorityStatus: 'UNVERIFIED' as const,
  candidateUpdatedAt: new Date('2026-07-14T00:20:00.000Z'),
}

const input = {
  jurisdictionId: 'jurisdiction-1',
  section: 'zoning' as const,
  fieldKey: 'minimumLotSizeSqft',
  extractedValue: {
    value: 7500,
    confidence: 0.99,
    volatility: 'annual',
    normalizedUnit: 'square_feet',
    geographicScope: 'unincorporated county',
    effectiveAt: '2026-01-01T00:00:00.000Z',
  },
  question,
  reviewerId: 'clerk-reviewer-1',
  reviewerLabel: 'reviewer@example.test',
  reviewedAt,
  source,
}

describe('jurisdiction claim publication records', () => {
  it('keeps source authority and human review as separate states', () => {
    expect(claimVerificationState(question, source)).toBe('REVIEWED')
    expect(claimVerificationState(question, {
      authorityStatus: 'VERIFIED',
      authorityClass: question.expectedAuthority,
      authorityOwner: source.authorityOwner,
      authorityVerifiedAt: reviewedAt,
      authorityVerifiedBy: 'authority-reviewer-1',
    })).toBe('VERIFIED')
    expect(claimVerificationState(question, {
      authorityStatus: 'VERIFIED',
      authorityClass: 'MARKET_DATA',
      authorityOwner: source.authorityOwner,
      authorityVerifiedAt: reviewedAt,
      authorityVerifiedBy: 'authority-reviewer-1',
    })).toBe('REVIEWED')
    expect(claimVerificationState(question, {
      authorityStatus: 'VERIFIED',
      authorityClass: question.expectedAuthority,
      authorityVerifiedAt: reviewedAt,
      authorityVerifiedBy: 'authority-reviewer-1',
    })).toBe('REVIEWED')
  })

  it('copies immutable evidence and stamps the profile projection with the durable claim', () => {
    const publication = buildClaimPublication({
      ...input,
      claimId: 'claim-2',
      supersedesClaimId: 'claim-1',
    })

    expect(publication.claim).toMatchObject({
      id: 'claim-2',
      supersedesClaimId: 'claim-1',
      expectedAuthorityClass: question.expectedAuthority,
      sourceAuthorityOwner: 'Example County Planning Department',
      sourceAuthorityStatus: 'UNVERIFIED',
      verificationState: 'REVIEWED',
      value: 7500,
    })
    expect(publication.evidence).toMatchObject({
      claimId: 'claim-2',
      sourceUrlId: 'source-1',
      candidateId: 'candidate-1',
      sourceUrl: source.url,
      sourceSnippet: source.snippet,
      contentHash: 'content-sha256',
    })
    expect(publication.profileField).toMatchObject({
      claimId: 'claim-2',
      value: 7500,
      sourceAuthorityStatus: 'UNVERIFIED',
      verificationState: 'REVIEWED',
      verifiedAt: reviewedAt.toISOString(),
      verifiedById: 'clerk-reviewer-1',
    })
  })

  it('discards hostile client provenance', () => {
    const publication = buildClaimPublication({
      ...input,
      claimId: 'server-claim',
      extractedValue: {
        ...input.extractedValue,
        claimId: 'client-claim',
        questionId: 'client-question',
        verificationState: 'VERIFIED',
        verifiedAt: '1999-01-01T00:00:00.000Z',
        verifiedById: 'client-reviewer',
        sourceAuthorityStatus: 'VERIFIED',
      },
    })

    expect(publication.profileField).toMatchObject({
      claimId: 'server-claim',
      questionId: question.id,
      verificationState: 'REVIEWED',
      verifiedAt: reviewedAt.toISOString(),
      verifiedById: 'clerk-reviewer-1',
      sourceAuthorityStatus: 'UNVERIFIED',
    })
  })

  it('fails closed for rejected sources and missing JSON values', () => {
    expect(() => buildClaimPublication({
      ...input,
      claimId: 'claim-rejected',
      source: { ...source, authorityStatus: 'REJECTED' },
    })).toThrow('SOURCE_REJECTED')
    expect(() => buildClaimPublication({
      ...input,
      claimId: 'claim-empty',
      extractedValue: { confidence: 1 },
    })).toThrow('CLAIM_VALUE_REQUIRED')
    expect(() => buildClaimPublication({
      ...input,
      claimId: 'claim-no-reviewer',
      reviewerId: ' ',
    })).toThrow('REVIEWER_REQUIRED')
  })
})

describe('atomic claim publication service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    tx.jurisdictionProfile.upsert.mockResolvedValue({
      zoning: { minimumLotSizeSqft: { claimId: 'claim-1' } },
    })
    tx.jurisdictionClaim.findFirst.mockResolvedValue({ id: 'claim-1' })
    tx.jurisdictionSourceUrl.findFirst.mockResolvedValue({
      url: source.url,
      lastFetchedAt: source.retrievedAt,
      lastContentHash: source.contentHash,
      authorityClass: source.authorityClass,
      authorityOwner: source.authorityOwner,
      authorityStatus: source.authorityStatus,
      authorityVerifiedAt: null,
      authorityVerifiedBy: null,
    })
    tx.jurisdictionClaim.create.mockResolvedValue({ id: 'new-claim' })
    tx.jurisdictionClaimEvidence.create.mockResolvedValue({ id: 'evidence-1' })
    tx.extractionCandidate.updateMany.mockResolvedValue({ count: 1 })
    tx.$queryRaw.mockResolvedValue([])
  })

  it('creates claim, copied evidence, projection, and candidate approval inside one transaction', async () => {
    const result = await publishJurisdictionClaim(input)

    expect(transaction).toHaveBeenCalledTimes(1)
    expect(tx.jurisdictionClaim.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ supersedesClaimId: 'claim-1' }),
    })
    expect(tx.jurisdictionClaimEvidence.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sourceUrl: source.url,
        sourceSnippet: source.snippet,
        candidateId: 'candidate-1',
      }),
    })
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1)
    expect(tx.extractionCandidate.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'candidate-1',
        status: 'PENDING',
        updatedAt: source.candidateUpdatedAt,
      },
      data: expect.objectContaining({ status: 'APPROVED' }),
    })
    expect(result.profileField.claimId).toBe(result.claimId)
  })

  it('aborts when the candidate was approved concurrently', async () => {
    tx.extractionCandidate.updateMany.mockResolvedValue({ count: 0 })
    await expect(publishJurisdictionClaim(input)).rejects.toThrow('CANDIDATE_NOT_PENDING')
  })

  it('re-reads authority inside the transaction and rejects a newly rejected source', async () => {
    tx.jurisdictionSourceUrl.findFirst.mockResolvedValue({
      url: source.url,
      lastFetchedAt: source.retrievedAt,
      lastContentHash: source.contentHash,
      authorityClass: source.authorityClass,
      authorityOwner: source.authorityOwner,
      authorityStatus: 'REJECTED',
      authorityVerifiedAt: reviewedAt,
      authorityVerifiedBy: 'authority-reviewer-1',
    })

    await expect(publishJurisdictionClaim(input)).rejects.toThrow('SOURCE_REJECTED')
    expect(tx.jurisdictionClaim.create).not.toHaveBeenCalled()
  })
})
