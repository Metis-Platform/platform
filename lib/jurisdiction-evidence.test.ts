import { describe, expect, it, vi } from 'vitest'
import {
  archiveJurisdictionEvidence,
  JURISDICTION_EVIDENCE_MAX_BYTES,
  JURISDICTION_EVIDENCE_MEDIA_TYPE,
  prepareJurisdictionEvidence,
  type JurisdictionEvidenceObjectStore,
} from './jurisdiction-evidence'

function matchingStore(
  prepared: ReturnType<typeof prepareJurisdictionEvidence>,
  result: 'created' | 'exists' = 'created',
): JurisdictionEvidenceObjectStore {
  return {
    putIfAbsent: vi.fn().mockResolvedValue(result),
    head: vi.fn().mockResolvedValue({
      contentLength: prepared.byteLength,
      contentType: prepared.representationMediaType,
      metadata: { sha256: prepared.contentHash },
    }),
  }
}

describe('jurisdiction evidence preparation', () => {
  it('hashes exact UTF-8 bytes into a deterministic content-addressed key', () => {
    const prepared = prepareJurisdictionEvidence('abc')

    expect(prepared.contentHash).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
    expect(prepared.byteLength).toBe(3)
    expect(prepared.storageKey).toBe(
      `jurisdiction-evidence/sha256/ba/${prepared.contentHash}.md`,
    )
    expect(prepared.representationMediaType).toBe(JURISDICTION_EVIDENCE_MEDIA_TYPE)
    expect(prepareJurisdictionEvidence('é').byteLength).toBe(2)
  })

  it('rejects empty and oversized representations before storage or AI work', () => {
    expect(() => prepareJurisdictionEvidence('')).toThrow('EVIDENCE_EMPTY')
    expect(() => prepareJurisdictionEvidence('x'.repeat(
      JURISDICTION_EVIDENCE_MAX_BYTES + 1,
    ))).toThrow('EVIDENCE_TOO_LARGE')
  })
})

describe('jurisdiction evidence archival', () => {
  it.each(['created', 'exists'] as const)(
    'verifies stored metadata after a conditional %s result',
    async result => {
      const prepared = prepareJurisdictionEvidence('Official county rule')
      const store = matchingStore(prepared, result)

      const archived = await archiveJurisdictionEvidence(prepared, store)

      expect(store.putIfAbsent).toHaveBeenCalledWith({
        key: prepared.storageKey,
        body: prepared.bytes,
        contentType: prepared.representationMediaType,
        metadata: { sha256: prepared.contentHash },
      })
      expect(store.head).toHaveBeenCalledWith(prepared.storageKey)
      expect(archived).not.toHaveProperty('bytes')
      expect(archived).toMatchObject({
        contentHash: prepared.contentHash,
        storageKey: prepared.storageKey,
        byteLength: prepared.byteLength,
      })
    },
  )

  it.each([
    ['EVIDENCE_STORED_LENGTH_MISMATCH', { contentLength: 1 }],
    ['EVIDENCE_STORED_MEDIA_TYPE_MISMATCH', { contentType: 'text/html' }],
    ['EVIDENCE_STORED_HASH_MISMATCH', { metadata: { sha256: 'wrong' } }],
  ])('fails closed on %s', async (code, override) => {
    const prepared = prepareJurisdictionEvidence('Official county rule')
    const store = matchingStore(prepared)
    vi.mocked(store.head).mockResolvedValue({
      contentLength: prepared.byteLength,
      contentType: prepared.representationMediaType,
      metadata: { sha256: prepared.contentHash },
      ...override,
    })

    await expect(archiveJurisdictionEvidence(prepared, store)).rejects.toThrow(code)
  })
})
