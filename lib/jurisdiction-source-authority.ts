import { z } from 'zod'
import { db } from './db'
import { JURISDICTION_AUTHORITY_CLASSES } from './jurisdiction-authority'

const expectedVersion = z.string().datetime().transform(value => new Date(value))
const explanation = z.string().trim().min(10).max(4000)
const externalHttpUrl = z.string().url().max(2000).refine(value => {
  const protocol = new URL(value).protocol
  return protocol === 'https:' || protocol === 'http:'
})

export const sourceAuthorityReviewSchema = z.discriminatedUnion('decision', [
  z.object({
    decision: z.literal('VERIFIED'),
    expectedUpdatedAt: expectedVersion,
    authorityClass: z.enum(JURISDICTION_AUTHORITY_CLASSES),
    authorityOwner: z.string().trim().min(2).max(300),
    evidenceUrl: externalHttpUrl,
    explanation,
  }),
  z.object({
    decision: z.literal('REJECTED'),
    expectedUpdatedAt: expectedVersion,
    explanation,
  }),
  z.object({
    decision: z.literal('UNVERIFIED'),
    expectedUpdatedAt: expectedVersion,
    explanation,
  }),
])

export type SourceAuthorityReviewInput = z.output<typeof sourceAuthorityReviewSchema>

export async function reviewJurisdictionSourceAuthority(input: {
  sourceId: string
  review: SourceAuthorityReviewInput
  reviewerId: string
  reviewedAt?: Date
}) {
  if (!input.reviewerId.trim()) throw new Error('REVIEWER_REQUIRED')
  const reviewedAt = input.reviewedAt ?? new Date()

  return db.$transaction(async tx => {
    const source = await tx.jurisdictionSourceUrl.findUnique({
      where: { id: input.sourceId },
      select: {
        id: true,
        jurisdictionId: true,
        url: true,
        officeType: true,
        lastContentHash: true,
        updatedAt: true,
      },
    })
    if (!source) throw new Error('SOURCE_NOT_FOUND')
    if (source.updatedAt.getTime() !== input.review.expectedUpdatedAt.getTime()) {
      throw new Error('STALE_SOURCE')
    }

    const verifiedReview = input.review.decision === 'VERIFIED' ? input.review : null
    const currentProjection = verifiedReview
      ? {
          authorityStatus: 'VERIFIED' as const,
          authorityClass: verifiedReview.authorityClass,
          authorityOwner: verifiedReview.authorityOwner,
          authorityVerifiedAt: reviewedAt,
          authorityVerifiedBy: input.reviewerId,
        }
      : {
          authorityStatus: input.review.decision,
          authorityClass: null,
          authorityOwner: null,
          authorityVerifiedAt: null,
          authorityVerifiedBy: null,
        }

    const updated = await tx.jurisdictionSourceUrl.updateMany({
      where: { id: source.id, updatedAt: source.updatedAt },
      data: currentProjection,
    })
    if (updated.count !== 1) throw new Error('STALE_SOURCE')

    const authorityReview = await tx.jurisdictionSourceAuthorityReview.create({
      data: {
        jurisdictionId: source.jurisdictionId,
        sourceUrlId: source.id,
        sourceUrl: source.url,
        officeType: source.officeType,
        sourceContentHash: source.lastContentHash,
        sourceUpdatedAt: source.updatedAt,
        decision: input.review.decision,
        authorityClass: verifiedReview?.authorityClass ?? null,
        authorityOwner: verifiedReview?.authorityOwner ?? null,
        evidenceUrl: verifiedReview?.evidenceUrl ?? null,
        explanation: input.review.explanation,
        reviewedAt,
        reviewedBy: input.reviewerId,
      },
    })

    return { sourceId: source.id, authorityReview, currentProjection }
  })
}
