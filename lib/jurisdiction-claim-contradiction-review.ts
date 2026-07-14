import { Prisma } from '@/app/generated/prisma'
import { db } from './db'
import {
  claimValuesConflict,
  extractedClaimValue,
} from './jurisdiction-claim-contradiction'
import { isJurisdictionProfileSection } from './jurisdiction-profile'

export type NonReplacementContradictionDecision = 'REJECTED_CHALLENGE' | 'NOT_COMPARABLE'

export interface RejectJurisdictionCandidateInput {
  candidateId: string
  expectedCandidateUpdatedAt: Date
  expectedCurrentClaimId?: string
  decision?: NonReplacementContradictionDecision
  explanation?: string
  reviewerId: string
  reviewerLabel: string
  reviewedAt?: Date
}

export async function rejectJurisdictionCandidate(input: RejectJurisdictionCandidateInput) {
  const reviewerId = input.reviewerId.trim()
  if (!reviewerId) throw new Error('REVIEWER_REQUIRED')
  if (Number.isNaN(input.expectedCandidateUpdatedAt.getTime())) {
    throw new Error('EXPECTED_VERSION_REQUIRED')
  }
  const reviewedAt = input.reviewedAt ?? new Date()

  return db.$transaction(async tx => {
    const candidate = await tx.extractionCandidate.findFirst({
      where: {
        id: input.candidateId,
        status: 'PENDING',
        updatedAt: input.expectedCandidateUpdatedAt,
      },
      select: {
        id: true,
        jurisdictionId: true,
        section: true,
        fieldKey: true,
        extractedValue: true,
        updatedAt: true,
        sourceUrlId: true,
        sourceSnippet: true,
        modelUsed: true,
        evidenceSnapshot: {
          select: {
            id: true,
            jurisdictionId: true,
            sourceUrlId: true,
            sourceUrl: true,
            retrievedAt: true,
            retrievalAdapter: true,
            representationMediaType: true,
            contentHash: true,
            storageKey: true,
            byteLength: true,
          },
        },
      },
    })
    if (!candidate) throw new Error('CANDIDATE_NOT_PENDING')
    if (!isJurisdictionProfileSection(candidate.section)) throw new Error('CLAIM_SECTION_INVALID')

    // Lock the read projection so replacement publication and this decision serialize.
    const projection = await tx.$queryRaw<Array<{ currentClaimId: string | null }>>`
      SELECT ${Prisma.raw(`"${candidate.section}"`)} -> ${candidate.fieldKey} ->> 'claimId'
        AS "currentClaimId"
      FROM "JurisdictionProfile"
      WHERE "jurisdictionId" = ${candidate.jurisdictionId}
      FOR UPDATE
    `
    const currentClaimId = projection[0]?.currentClaimId ?? null
    const existingClaim = currentClaimId
      ? await tx.jurisdictionClaim.findFirst({
          where: {
            id: currentClaimId,
            jurisdictionId: candidate.jurisdictionId,
            section: candidate.section,
            fieldKey: candidate.fieldKey,
            supersededByClaim: null,
          },
          select: {
            id: true,
            questionId: true,
            questionSchemaVersion: true,
            value: true,
            normalizedUnit: true,
          },
        })
      : null
    if (currentClaimId && !existingClaim) throw new Error('STALE_CLAIM_CONTRADICTION')

    const proposed = extractedClaimValue(candidate.extractedValue)
    const hasContradiction = Boolean(existingClaim && claimValuesConflict(existingClaim, proposed))
    if (hasContradiction) {
      if (!input.decision) throw new Error('CLAIM_CONTRADICTION_RESOLUTION_REQUIRED')
      if (input.expectedCurrentClaimId !== currentClaimId) {
        throw new Error('STALE_CLAIM_CONTRADICTION')
      }
      if ((input.explanation ?? '').trim().length < 10) {
        throw new Error('CLAIM_CONTRADICTION_EXPLANATION_REQUIRED')
      }
    } else if (input.decision || input.explanation || input.expectedCurrentClaimId) {
      throw new Error('CLAIM_CONTRADICTION_NOT_PRESENT')
    }

    const snapshot = candidate.evidenceSnapshot
    if (hasContradiction && (
      !snapshot ||
      !candidate.sourceUrlId ||
      snapshot.sourceUrlId !== candidate.sourceUrlId ||
      snapshot.jurisdictionId !== candidate.jurisdictionId
    )) {
      throw new Error('CLAIM_CONTRADICTION_EVIDENCE_REQUIRED')
    }
    if (
      candidate.updatedAt.getTime() > reviewedAt.getTime() ||
      (snapshot && snapshot.retrievedAt.getTime() > reviewedAt.getTime())
    ) {
      throw new Error('EVIDENCE_RETRIEVED_AT_INVALID')
    }
    const proposedSerialized = JSON.stringify(proposed.value)
    if (proposedSerialized === undefined) throw new Error('CLAIM_VALUE_REQUIRED')

    const updated = await tx.extractionCandidate.updateMany({
      where: {
        id: candidate.id,
        status: 'PENDING',
        updatedAt: input.expectedCandidateUpdatedAt,
      },
      data: {
        status: 'REJECTED',
        reviewedAt,
        reviewedBy: input.reviewerLabel,
      },
    })
    if (updated.count !== 1) throw new Error('CANDIDATE_NOT_PENDING')

    if (!hasContradiction || !existingClaim || !snapshot || !input.decision) {
      return { reviewId: null, decision: 'REJECTED' as const }
    }

    const review = await tx.jurisdictionClaimContradictionReview.create({
      data: {
        jurisdictionId: candidate.jurisdictionId,
        questionId: existingClaim.questionId,
        questionSchemaVersion: existingClaim.questionSchemaVersion,
        section: candidate.section,
        fieldKey: candidate.fieldKey,
        existingClaimId: existingClaim.id,
        candidateId: candidate.id,
        candidateReferenceId: candidate.id,
        candidateUpdatedAt: candidate.updatedAt,
        evidenceSnapshotId: snapshot.id,
        evidenceSnapshotReferenceId: snapshot.id,
        sourceUrlId: candidate.sourceUrlId!,
        existingValue: existingClaim.value === null
          ? Prisma.JsonNull
          : JSON.parse(JSON.stringify(existingClaim.value)) as Prisma.InputJsonValue,
        proposedValue: JSON.parse(proposedSerialized) as Prisma.InputJsonValue,
        existingNormalizedUnit: existingClaim.normalizedUnit ?? undefined,
        proposedNormalizedUnit: proposed.normalizedUnit ?? undefined,
        sourceUrl: snapshot.sourceUrl,
        sourceSnippet: candidate.sourceSnippet ?? '',
        evidenceRetrievedAt: snapshot.retrievedAt,
        contentHash: snapshot.contentHash,
        storageKey: snapshot.storageKey,
        retrievalAdapter: snapshot.retrievalAdapter,
        representationMediaType: snapshot.representationMediaType,
        byteLength: snapshot.byteLength,
        modelUsed: candidate.modelUsed,
        decision: input.decision,
        explanation: input.explanation!.trim(),
        reviewedAt,
        reviewedBy: reviewerId,
      },
      select: { id: true },
    })

    return { reviewId: review.id, decision: input.decision }
  })
}
