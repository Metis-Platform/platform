import { beforeEach, describe, expect, it, vi } from 'vitest'

const { tx, transaction, snapshotCreate } = vi.hoisted(() => {
  const client = {
    jurisdictionEvidenceSnapshot: { create: vi.fn() },
    extractionCandidate: {
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    jurisdictionSourceUrl: { updateMany: vi.fn() },
  }
  return {
    tx: client,
    transaction: vi.fn(async (callback: (value: typeof client) => Promise<unknown>) => callback(client)),
    snapshotCreate: vi.fn(),
  }
})

vi.mock('./db', () => ({
  db: {
    $transaction: transaction,
    jurisdictionEvidenceSnapshot: { create: snapshotCreate },
  },
}))

import {
  persistJurisdictionRetrieval,
  recordJurisdictionEvidenceSnapshot,
} from './jurisdiction-extraction-persistence'

const retrievedAt = new Date('2026-07-14T01:20:00.000Z')
const sourceUpdatedAt = new Date('2026-07-14T01:00:00.000Z')
const evidence = {
  byteLength: 123,
  contentHash: 'a'.repeat(64),
  storageKey: `jurisdiction-evidence/sha256/aa/${'a'.repeat(64)}.md`,
  representationMediaType: 'text/markdown; charset=utf-8' as const,
  retrievalAdapter: 'JINA_READER' as const,
}
const candidate = {
  section: 'zoning',
  fieldKey: 'minimumLotSizeSqft',
  extractedValue: { value: 7500 },
  confidence: 0.94,
  sourceSnippet: 'Minimum lot area is 7,500 square feet.',
  modelUsed: 'claude-test',
}
const baseInput = {
  jurisdictionId: 'jurisdiction-1',
  sourceUrlId: 'source-1',
  sourceUrl: 'https://county.example.gov/zoning',
  sourceUpdatedAt,
  retrievedAt,
  evidence,
}

describe('atomic jurisdiction retrieval persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    tx.jurisdictionEvidenceSnapshot.create.mockResolvedValue({ id: 'snapshot-1' })
    tx.extractionCandidate.findFirst.mockResolvedValue(null)
    tx.extractionCandidate.create.mockResolvedValue({ id: 'candidate-1' })
    tx.extractionCandidate.update.mockResolvedValue({ id: 'candidate-1' })
    tx.jurisdictionSourceUrl.updateMany.mockResolvedValue({ count: 1 })
    snapshotCreate.mockResolvedValue({ id: 'snapshot-failed-extraction' })
  })

  it('records a retrieved representation without advancing source state after extraction fails', async () => {
    await recordJurisdictionEvidenceSnapshot(baseInput)

    expect(snapshotCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        jurisdictionId: 'jurisdiction-1',
        sourceUrlId: 'source-1',
        contentHash: evidence.contentHash,
      }),
      select: { id: true },
    })
    expect(transaction).not.toHaveBeenCalled()
    expect(tx.jurisdictionSourceUrl.updateMany).not.toHaveBeenCalled()
  })

  it('records an unchanged retrieval without mutating candidates', async () => {
    await persistJurisdictionRetrieval({
      ...baseInput,
      contentChanged: false,
      candidates: [],
    })

    expect(tx.jurisdictionEvidenceSnapshot.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sourceUrl: baseInput.sourceUrl,
        retrievedAt,
        contentHash: evidence.contentHash,
        storageKey: evidence.storageKey,
      }),
      select: { id: true },
    })
    expect(tx.extractionCandidate.findFirst).not.toHaveBeenCalled()
    expect(tx.extractionCandidate.create).not.toHaveBeenCalled()
    expect(tx.extractionCandidate.update).not.toHaveBeenCalled()
    expect(tx.jurisdictionSourceUrl.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'source-1',
        jurisdictionId: 'jurisdiction-1',
        updatedAt: sourceUpdatedAt,
      },
      data: { lastFetchedAt: retrievedAt },
    })
  })

  it('links a changed retrieval snapshot to a new candidate and source cursor', async () => {
    await persistJurisdictionRetrieval({
      ...baseInput,
      contentChanged: true,
      candidates: [candidate],
    })

    expect(tx.extractionCandidate.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        jurisdictionId: 'jurisdiction-1',
        sourceUrlId: 'source-1',
        evidenceSnapshotId: 'snapshot-1',
        section: candidate.section,
        fieldKey: candidate.fieldKey,
      }),
    })
    expect(tx.jurisdictionSourceUrl.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ updatedAt: sourceUpdatedAt }),
      data: {
        lastFetchedAt: retrievedAt,
        lastContentHash: evidence.contentHash,
      },
    })
  })

  it('moves an existing pending candidate to the exact new snapshot', async () => {
    tx.extractionCandidate.findFirst.mockResolvedValue({ id: 'pending-1' })

    await persistJurisdictionRetrieval({
      ...baseInput,
      contentChanged: true,
      candidates: [candidate],
    })

    expect(tx.extractionCandidate.update).toHaveBeenCalledWith({
      where: { id: 'pending-1' },
      data: expect.objectContaining({ evidenceSnapshotId: 'snapshot-1' }),
    })
    expect(tx.extractionCandidate.create).not.toHaveBeenCalled()
  })

  it('fails the transaction when the source changed during extraction', async () => {
    tx.jurisdictionSourceUrl.updateMany.mockResolvedValue({ count: 0 })

    await expect(persistJurisdictionRetrieval({
      ...baseInput,
      contentChanged: true,
      candidates: [candidate],
    })).rejects.toThrow('SOURCE_CHANGED_DURING_EXTRACTION')
  })

  it('rejects candidates for an unchanged retrieval before opening a transaction', async () => {
    await expect(persistJurisdictionRetrieval({
      ...baseInput,
      contentChanged: false,
      candidates: [candidate],
    })).rejects.toThrow('UNCHANGED_RETRIEVAL_HAS_CANDIDATES')
    expect(transaction).not.toHaveBeenCalled()
  })
})
