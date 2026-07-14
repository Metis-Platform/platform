import { Prisma } from '@/app/generated/prisma'
import { db } from './db'
import type { PreparedJurisdictionEvidence } from './jurisdiction-evidence'

type ArchivedJurisdictionEvidence = Omit<PreparedJurisdictionEvidence, 'bytes'>

export interface JurisdictionCandidateDraft {
  section: string
  fieldKey: string
  extractedValue: Prisma.InputJsonValue
  confidence: number
  sourceSnippet: string
  modelUsed: string
}

export interface PersistJurisdictionRetrievalInput {
  jurisdictionId: string
  sourceUrlId: string
  sourceUrl: string
  sourceUpdatedAt: Date
  retrievedAt: Date
  evidence: ArchivedJurisdictionEvidence
  contentChanged: boolean
  candidates: JurisdictionCandidateDraft[]
}

type RecordJurisdictionEvidenceSnapshotInput = Omit<
  PersistJurisdictionRetrievalInput,
  'sourceUpdatedAt' | 'contentChanged' | 'candidates'
>

function snapshotData(input: RecordJurisdictionEvidenceSnapshotInput) {
  return {
    jurisdictionId: input.jurisdictionId,
    sourceUrlId: input.sourceUrlId,
    sourceUrl: input.sourceUrl,
    retrievedAt: input.retrievedAt,
    retrievalAdapter: input.evidence.retrievalAdapter,
    representationMediaType: input.evidence.representationMediaType,
    contentHash: input.evidence.contentHash,
    storageKey: input.evidence.storageKey,
    byteLength: input.evidence.byteLength,
  }
}

/** Records a verified retrieval that could not proceed to extraction. Source cursors stay unchanged. */
export async function recordJurisdictionEvidenceSnapshot(
  input: RecordJurisdictionEvidenceSnapshotInput,
) {
  return db.jurisdictionEvidenceSnapshot.create({
    data: snapshotData(input),
    select: { id: true },
  })
}

/**
 * Commits one immutable retrieval event, all candidate projections, and the mutable
 * source cursor together. The R2 object must already have passed integrity checks.
 */
export async function persistJurisdictionRetrieval(input: PersistJurisdictionRetrievalInput) {
  if (!input.contentChanged && input.candidates.length > 0) {
    throw new Error('UNCHANGED_RETRIEVAL_HAS_CANDIDATES')
  }

  return db.$transaction(async tx => {
    const snapshot = await tx.jurisdictionEvidenceSnapshot.create({
      data: snapshotData(input),
      select: { id: true },
    })

    for (const candidate of input.candidates) {
      const existing = await tx.extractionCandidate.findFirst({
        where: {
          jurisdictionId: input.jurisdictionId,
          section: candidate.section,
          fieldKey: candidate.fieldKey,
          status: 'PENDING',
        },
        select: { id: true },
      })

      const data = {
        sourceUrlId: input.sourceUrlId,
        evidenceSnapshotId: snapshot.id,
        extractedValue: candidate.extractedValue,
        confidence: candidate.confidence,
        sourceSnippet: candidate.sourceSnippet,
        modelUsed: candidate.modelUsed,
      }
      if (existing) {
        await tx.extractionCandidate.update({ where: { id: existing.id }, data })
      } else {
        await tx.extractionCandidate.create({
          data: {
            jurisdictionId: input.jurisdictionId,
            section: candidate.section,
            fieldKey: candidate.fieldKey,
            ...data,
          },
        })
      }
    }

    const advanced = await tx.jurisdictionSourceUrl.updateMany({
      where: {
        id: input.sourceUrlId,
        jurisdictionId: input.jurisdictionId,
        updatedAt: input.sourceUpdatedAt,
      },
      data: {
        lastFetchedAt: input.retrievedAt,
        ...(input.contentChanged ? { lastContentHash: input.evidence.contentHash } : {}),
      },
    })
    if (advanced.count !== 1) throw new Error('SOURCE_CHANGED_DURING_EXTRACTION')

    return { snapshotId: snapshot.id }
  })
}
