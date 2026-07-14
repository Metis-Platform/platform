import { Prisma } from '@/app/generated/prisma'
import { randomUUID } from 'node:crypto'
import { db } from './db'
import type { JurisdictionProfileSection } from './jurisdiction-profile'
import type { JurisdictionQuestionDefinition } from './jurisdiction-question-library'

export type SourceAuthorityStatus = 'UNVERIFIED' | 'VERIFIED' | 'REJECTED'
export type ClaimVerificationState = 'REVIEWED' | 'VERIFIED'

export interface ClaimPublicationSource {
  sourceUrlId?: string | null
  candidateId?: string | null
  url: string
  snippet: string
  retrievedAt: Date
  contentHash?: string | null
  evidenceSnapshotId?: string | null
  storageKey?: string | null
  retrievalAdapter?: 'JINA_READER' | null
  representationMediaType?: string | null
  byteLength?: number | null
  modelUsed?: string | null
  authorityClass?: string | null
  authorityOwner?: string | null
  authorityStatus: SourceAuthorityStatus
  authorityVerifiedAt?: Date | null
  authorityVerifiedBy?: string | null
  candidateUpdatedAt?: Date | null
}

export interface ClaimPublicationInput {
  jurisdictionId: string
  section: JurisdictionProfileSection
  fieldKey: string
  extractedValue: Record<string, unknown>
  question: JurisdictionQuestionDefinition
  reviewerId: string
  reviewerLabel: string
  reviewedAt?: Date
  source: ClaimPublicationSource
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function optionalDate(value: unknown): Date | undefined {
  if (typeof value !== 'string') return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

function inputJsonValue(value: unknown): Prisma.InputJsonValue {
  const serialized = JSON.stringify(value)
  if (serialized === undefined) throw new Error('CLAIM_VALUE_REQUIRED')
  return JSON.parse(serialized) as Prisma.InputJsonValue
}

export function claimVerificationState(
  question: JurisdictionQuestionDefinition,
  source: Pick<
    ClaimPublicationSource,
    | 'authorityClass'
    | 'authorityOwner'
    | 'authorityStatus'
    | 'authorityVerifiedAt'
    | 'authorityVerifiedBy'
  >
): ClaimVerificationState {
  if (
    source.authorityStatus === 'VERIFIED' &&
    source.authorityClass === question.expectedAuthority &&
    Boolean(source.authorityOwner?.trim()) &&
    source.authorityVerifiedAt instanceof Date &&
    !Number.isNaN(source.authorityVerifiedAt.getTime()) &&
    Boolean(source.authorityVerifiedBy?.trim())
  ) {
    return 'VERIFIED'
  }
  return 'REVIEWED'
}

export function buildClaimPublication(input: ClaimPublicationInput & {
  claimId: string
  supersedesClaimId?: string | null
}) {
  if (input.source.authorityStatus === 'REJECTED') {
    throw new Error('SOURCE_REJECTED')
  }
  if (!input.source.url.trim()) throw new Error('SOURCE_URL_REQUIRED')
  if (!input.source.snippet.trim()) throw new Error('SOURCE_SNIPPET_REQUIRED')
  if (!input.reviewerId.trim()) throw new Error('REVIEWER_REQUIRED')
  if (input.source.evidenceSnapshotId && (
    !input.source.contentHash ||
    !input.source.storageKey ||
    !input.source.retrievalAdapter ||
    !input.source.representationMediaType ||
    !input.source.byteLength ||
    input.source.byteLength < 1
  )) {
    throw new Error('EVIDENCE_SNAPSHOT_INCOMPLETE')
  }
  const reviewedAt = input.reviewedAt ?? new Date()
  const verificationState = claimVerificationState(input.question, input.source)
  const rawConfidence = typeof input.extractedValue.confidence === 'number'
    ? input.extractedValue.confidence
    : 0
  const confidence = Math.min(1, Math.max(0, rawConfidence))
  const volatility = optionalString(input.extractedValue.volatility) ?? 'static'
  const normalizedUnit = optionalString(input.extractedValue.normalizedUnit)
  const geographicScope = optionalString(input.extractedValue.geographicScope)
  const effectiveAt = optionalDate(input.extractedValue.effectiveAt)
  const value = inputJsonValue(input.extractedValue.value)

  // Only known profile attributes cross the trust boundary. Client-supplied provenance is discarded.
  const profileField = {
    value,
    sourceUrl: input.source.url,
    citation: input.source.snippet,
    retrievedAt: input.source.retrievedAt.toISOString(),
    ...(normalizedUnit ? { normalizedUnit } : {}),
    ...(geographicScope ? { geographicScope } : {}),
    ...(effectiveAt ? { effectiveAt: effectiveAt.toISOString() } : {}),
    confidence,
    volatility,
    claimId: input.claimId,
    questionId: input.question.id,
    questionSchemaVersion: input.question.schemaVersion,
    expectedAuthorityClass: input.question.expectedAuthority,
    sourceAuthorityClass: input.source.authorityClass ?? undefined,
    sourceAuthorityOwner: input.source.authorityOwner ?? undefined,
    sourceAuthorityStatus: input.source.authorityStatus,
    sourceAuthorityVerifiedAt: input.source.authorityVerifiedAt?.toISOString(),
    sourceAuthorityVerifiedBy: input.source.authorityVerifiedBy ?? undefined,
    verificationState,
    verifiedAt: reviewedAt.toISOString(),
    verifiedById: input.reviewerId,
  }

  return {
    verificationState,
    profileField,
    claim: {
      id: input.claimId,
      jurisdictionId: input.jurisdictionId,
      questionId: input.question.id,
      questionSchemaVersion: input.question.schemaVersion,
      section: input.section,
      fieldKey: input.fieldKey,
      value,
      normalizedUnit,
      expectedAuthorityClass: input.question.expectedAuthority,
      sourceAuthorityClass: input.source.authorityClass ?? undefined,
      sourceAuthorityOwner: input.source.authorityOwner ?? undefined,
      sourceAuthorityStatus: input.source.authorityStatus,
      sourceAuthorityVerifiedAt: input.source.authorityVerifiedAt ?? undefined,
      sourceAuthorityVerifiedBy: input.source.authorityVerifiedBy ?? undefined,
      verificationState,
      geographicScope,
      effectiveAt,
      reviewedAt,
      reviewedBy: input.reviewerId,
      supersedesClaimId: input.supersedesClaimId ?? undefined,
    },
    evidence: {
      claimId: input.claimId,
      sourceUrlId: input.source.sourceUrlId ?? undefined,
      candidateId: input.source.candidateId ?? undefined,
      evidenceSnapshotId: input.source.evidenceSnapshotId ?? undefined,
      sourceUrl: input.source.url,
      sourceSnippet: input.source.snippet,
      retrievedAt: input.source.retrievedAt,
      contentHash: input.source.contentHash ?? undefined,
      storageKey: input.source.storageKey ?? undefined,
      retrievalAdapter: input.source.retrievalAdapter ?? undefined,
      representationMediaType: input.source.representationMediaType ?? undefined,
      byteLength: input.source.byteLength ?? undefined,
      modelUsed: input.source.modelUsed ?? undefined,
    },
  }
}

export async function publishJurisdictionClaim(input: ClaimPublicationInput) {
  const reviewedAt = input.reviewedAt ?? new Date()
  return db.$transaction(async tx => {
    let trustedSource = input.source
    if (input.source.candidateId) {
      const candidate = await tx.extractionCandidate.findFirst({
        where: {
          id: input.source.candidateId,
          jurisdictionId: input.jurisdictionId,
          status: 'PENDING',
          ...(input.source.candidateUpdatedAt
            ? { updatedAt: input.source.candidateUpdatedAt }
            : {}),
        },
        select: {
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
      const snapshot = candidate.evidenceSnapshot
      if (!snapshot) throw new Error('EVIDENCE_SNAPSHOT_REQUIRED')
      if (
        snapshot.jurisdictionId !== input.jurisdictionId ||
        snapshot.sourceUrlId !== candidate.sourceUrlId
      ) {
        throw new Error('EVIDENCE_SNAPSHOT_SCOPE_MISMATCH')
      }
      trustedSource = {
        ...input.source,
        sourceUrlId: candidate.sourceUrlId,
        url: snapshot.sourceUrl,
        snippet: candidate.sourceSnippet ?? '',
        retrievedAt: snapshot.retrievedAt,
        contentHash: snapshot.contentHash,
        evidenceSnapshotId: snapshot.id,
        storageKey: snapshot.storageKey,
        retrievalAdapter: snapshot.retrievalAdapter,
        representationMediaType: snapshot.representationMediaType,
        byteLength: snapshot.byteLength,
        modelUsed: candidate.modelUsed,
      }
    }

    const profile = await tx.jurisdictionProfile.upsert({
      where: { jurisdictionId: input.jurisdictionId },
      update: {},
      create: { jurisdictionId: input.jurisdictionId },
    })
    const sectionFields = profile[input.section] as Record<string, unknown>
    const projectedClaimId = (sectionFields[input.fieldKey] as { claimId?: unknown } | undefined)?.claimId
    const superseded = typeof projectedClaimId === 'string'
      ? await tx.jurisdictionClaim.findFirst({
          where: {
            id: projectedClaimId,
            jurisdictionId: input.jurisdictionId,
            section: input.section,
            fieldKey: input.fieldKey,
          },
          select: { id: true },
        })
      : null

    // Re-read the mutable source authority record inside the transaction. Route data is only a hint.
    if (trustedSource.sourceUrlId) {
      const persistedSource = await tx.jurisdictionSourceUrl.findFirst({
        where: {
          id: trustedSource.sourceUrlId,
          jurisdictionId: input.jurisdictionId,
        },
        select: {
          url: true,
          authorityClass: true,
          authorityOwner: true,
          authorityStatus: true,
          authorityVerifiedAt: true,
          authorityVerifiedBy: true,
        },
      })
      if (!persistedSource) throw new Error('SOURCE_NOT_FOUND')
      trustedSource = {
        ...trustedSource,
        // Snapshot-backed evidence retains the URL copied at retrieval time. Manual
        // citations without a snapshot use the current persisted source URL.
        url: trustedSource.evidenceSnapshotId ? trustedSource.url : persistedSource.url,
        authorityClass: persistedSource.authorityClass,
        authorityOwner: persistedSource.authorityOwner,
        authorityStatus: persistedSource.authorityStatus,
        authorityVerifiedAt: persistedSource.authorityVerifiedAt,
        authorityVerifiedBy: persistedSource.authorityVerifiedBy,
      }
    }

    const claimId = randomUUID()
    const publication = buildClaimPublication({
      ...input,
      reviewedAt,
      source: trustedSource,
      claimId,
      supersedesClaimId: superseded?.id,
    })

    await tx.jurisdictionClaim.create({
      data: publication.claim as Prisma.JurisdictionClaimUncheckedCreateInput,
    })
    await tx.jurisdictionClaimEvidence.create({
      data: publication.evidence,
    })

    await tx.$queryRaw`
      UPDATE "JurisdictionProfile"
      SET ${Prisma.raw(`"${input.section}"`)} = jsonb_set(
        COALESCE(${Prisma.raw(`"${input.section}"`)}, '{}'::jsonb),
        ARRAY[${input.fieldKey}],
        ${JSON.stringify(publication.profileField)}::jsonb,
        true
      ),
      "updatedAt" = NOW()
      WHERE "jurisdictionId" = ${input.jurisdictionId}
    `

    if (input.source.candidateId) {
      const approved = await tx.extractionCandidate.updateMany({
        where: {
          id: input.source.candidateId,
          status: 'PENDING',
          ...(input.source.candidateUpdatedAt
            ? { updatedAt: input.source.candidateUpdatedAt }
            : {}),
        },
        data: {
          status: 'APPROVED',
          reviewedAt,
          reviewedBy: input.reviewerLabel,
          extractedValue: publication.profileField,
        },
      })
      if (approved.count !== 1) throw new Error('CANDIDATE_NOT_PENDING')
    }

    return { claimId, ...publication }
  })
}
