import { Prisma } from '@/app/generated/prisma'
import { db } from './db'
import { calculateClaimFreshness } from './jurisdiction-claim-freshness'
import { isJurisdictionProfileSection } from './jurisdiction-profile'

export interface ReReviewJurisdictionClaimInput {
  claimId: string
  evidenceSnapshotId: string
  expectedFreshnessUpdatedAt: Date
  explanation: string
  reviewerId: string
  reviewedAt?: Date
}

export async function reReviewJurisdictionClaim(input: ReReviewJurisdictionClaimInput) {
  const reviewerId = input.reviewerId.trim()
  const explanation = input.explanation.trim()
  if (!reviewerId) throw new Error('REVIEWER_REQUIRED')
  if (explanation.length < 10) throw new Error('EXPLANATION_REQUIRED')
  if (Number.isNaN(input.expectedFreshnessUpdatedAt.getTime())) {
    throw new Error('EXPECTED_VERSION_REQUIRED')
  }
  const reviewedAt = input.reviewedAt ?? new Date()

  return db.$transaction(async tx => {
    const claim = await tx.jurisdictionClaim.findUnique({
      where: { id: input.claimId },
      select: {
        id: true,
        jurisdictionId: true,
        questionId: true,
        section: true,
        fieldKey: true,
        risk: true,
        volatility: true,
        supersededByClaim: { select: { id: true } },
        freshness: true,
        evidence: {
          select: { sourceUrlId: true, contentHash: true },
        },
      },
    })
    if (!claim?.freshness) throw new Error('CLAIM_NOT_FOUND')
    if (claim.supersededByClaim) throw new Error('CLAIM_SUPERSEDED')
    if (claim.freshness.updatedAt.getTime() !== input.expectedFreshnessUpdatedAt.getTime()) {
      throw new Error('STALE_CLAIM_REVIEW')
    }
    if (!isJurisdictionProfileSection(claim.section)) throw new Error('CLAIM_SECTION_INVALID')
    if (claim.risk === 'UNKNOWN') throw new Error('CLAIM_RISK_UNCLASSIFIED')
    if (claim.volatility === 'UNKNOWN') throw new Error('CLAIM_VOLATILITY_UNCLASSIFIED')

    const snapshot = await tx.jurisdictionEvidenceSnapshot.findFirst({
      where: {
        id: input.evidenceSnapshotId,
        jurisdictionId: claim.jurisdictionId,
        retrievedAt: { gt: claim.freshness.lastEvidenceRetrievedAt },
      },
      select: {
        id: true,
        sourceUrlId: true,
        sourceUrl: true,
        retrievedAt: true,
        retrievalAdapter: true,
        representationMediaType: true,
        contentHash: true,
        storageKey: true,
        byteLength: true,
      },
    })
    if (!snapshot?.sourceUrlId) throw new Error('EVIDENCE_SNAPSHOT_NOT_NEWER')
    if (snapshot.retrievedAt.getTime() > reviewedAt.getTime()) {
      throw new Error('EVIDENCE_RETRIEVED_AT_INVALID')
    }

    const matchesPriorEvidence = claim.evidence.some(evidence =>
      evidence.sourceUrlId === snapshot.sourceUrlId &&
      evidence.contentHash === snapshot.contentHash
    )
    if (!matchesPriorEvidence) throw new Error('EVIDENCE_CHANGED_REVIEW_REQUIRED')

    const source = await tx.jurisdictionSourceUrl.findFirst({
      where: {
        id: snapshot.sourceUrlId,
        jurisdictionId: claim.jurisdictionId,
      },
      select: { authorityStatus: true },
    })
    if (!source) throw new Error('SOURCE_NOT_FOUND')
    if (source.authorityStatus === 'REJECTED') throw new Error('SOURCE_REJECTED')

    const next = calculateClaimFreshness({
      volatility: claim.volatility,
      risk: claim.risk,
      evidenceRetrievedAt: snapshot.retrievedAt,
    })

    const updated = await tx.jurisdictionClaimFreshness.updateMany({
      where: {
        claimId: claim.id,
        updatedAt: input.expectedFreshnessUpdatedAt,
      },
      data: {
        lastEvidenceSnapshotId: snapshot.id,
        lastEvidenceRetrievedAt: snapshot.retrievedAt,
        reviewDueAt: next.reviewDueAt,
        staleAt: next.staleAt,
        policyVersion: next.policyVersion,
      },
    })
    if (updated.count !== 1) throw new Error('STALE_CLAIM_REVIEW')

    const reReview = await tx.jurisdictionClaimReReview.create({
      data: {
        claimId: claim.id,
        evidenceSnapshotId: snapshot.id,
        sourceUrlId: snapshot.sourceUrlId,
        sourceUrl: snapshot.sourceUrl,
        contentHash: snapshot.contentHash,
        storageKey: snapshot.storageKey,
        retrievalAdapter: snapshot.retrievalAdapter,
        representationMediaType: snapshot.representationMediaType,
        byteLength: snapshot.byteLength,
        evidenceRetrievedAt: snapshot.retrievedAt,
        decision: 'RECONFIRMED',
        previousReviewDueAt: claim.freshness.reviewDueAt,
        previousStaleAt: claim.freshness.staleAt,
        nextReviewDueAt: next.reviewDueAt,
        nextStaleAt: next.staleAt,
        policyVersion: next.policyVersion,
        explanation,
        reviewedAt,
        reviewedBy: reviewerId,
      },
      select: { id: true },
    })

    const projectionFreshness = JSON.stringify({
      freshnessConfirmedAt: snapshot.retrievedAt.toISOString(),
      reviewDueAt: next.reviewDueAt.toISOString(),
      staleAt: next.staleAt.toISOString(),
      freshnessPolicyVersion: next.policyVersion,
    })
    const projected = await tx.$executeRaw`
      UPDATE "JurisdictionProfile"
      SET ${Prisma.raw(`"${claim.section}"`)} = jsonb_set(
        COALESCE(${Prisma.raw(`"${claim.section}"`)}, '{}'::jsonb),
        ARRAY[${claim.fieldKey}],
        COALESCE(${Prisma.raw(`"${claim.section}"`)} -> ${claim.fieldKey}, '{}'::jsonb)
          || ${projectionFreshness}::jsonb,
        true
      ),
      "updatedAt" = NOW()
      WHERE "jurisdictionId" = ${claim.jurisdictionId}
        AND ${Prisma.raw(`"${claim.section}"`)} -> ${claim.fieldKey} ->> 'claimId' = ${claim.id}
    `
    if (projected !== 1) throw new Error('CLAIM_NOT_CURRENT')

    return {
      reReviewId: reReview.id,
      freshness: {
        lastEvidenceRetrievedAt: snapshot.retrievedAt,
        reviewDueAt: next.reviewDueAt,
        staleAt: next.staleAt,
        policyVersion: next.policyVersion,
      },
    }
  })
}
