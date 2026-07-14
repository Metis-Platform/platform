import { createHash } from 'node:crypto'
import { headObject, putObjectIfAbsent } from './r2'

export const JURISDICTION_EVIDENCE_MAX_BYTES = 2 * 1024 * 1024
export const JURISDICTION_EVIDENCE_MEDIA_TYPE = 'text/markdown; charset=utf-8'
export const JURISDICTION_EVIDENCE_RETRIEVAL_ADAPTER = 'JINA_READER' as const

export interface PreparedJurisdictionEvidence {
  bytes: Uint8Array
  byteLength: number
  contentHash: string
  storageKey: string
  representationMediaType: typeof JURISDICTION_EVIDENCE_MEDIA_TYPE
  retrievalAdapter: typeof JURISDICTION_EVIDENCE_RETRIEVAL_ADAPTER
}

export interface JurisdictionEvidenceObjectStore {
  putIfAbsent(input: {
    key: string
    body: Uint8Array
    contentType: string
    metadata: Record<string, string>
  }): Promise<'created' | 'exists'>
  head(key: string): Promise<{
    contentLength?: number
    contentType?: string
    metadata: Record<string, string>
  }>
}

const r2EvidenceStore: JurisdictionEvidenceObjectStore = {
  putIfAbsent: putObjectIfAbsent,
  head: headObject,
}

export function jurisdictionEvidenceStorageKey(contentHash: string): string {
  return `jurisdiction-evidence/sha256/${contentHash.slice(0, 2)}/${contentHash}.md`
}

export function prepareJurisdictionEvidence(content: string): PreparedJurisdictionEvidence {
  const bytes = Buffer.from(content, 'utf8')
  if (bytes.byteLength === 0) throw new Error('EVIDENCE_EMPTY')
  if (bytes.byteLength > JURISDICTION_EVIDENCE_MAX_BYTES) {
    throw new Error('EVIDENCE_TOO_LARGE')
  }
  const contentHash = createHash('sha256').update(bytes).digest('hex')
  return {
    bytes,
    byteLength: bytes.byteLength,
    contentHash,
    storageKey: jurisdictionEvidenceStorageKey(contentHash),
    representationMediaType: JURISDICTION_EVIDENCE_MEDIA_TYPE,
    retrievalAdapter: JURISDICTION_EVIDENCE_RETRIEVAL_ADAPTER,
  }
}

/**
 * R2 and PostgreSQL cannot commit together. Callers may persist snapshot metadata only
 * after this confirms that the immutable content-addressed object exists and matches.
 */
export async function archiveJurisdictionEvidence(
  prepared: PreparedJurisdictionEvidence,
  store: JurisdictionEvidenceObjectStore = r2EvidenceStore,
): Promise<Omit<PreparedJurisdictionEvidence, 'bytes'>> {
  await store.putIfAbsent({
    key: prepared.storageKey,
    body: prepared.bytes,
    contentType: prepared.representationMediaType,
    metadata: { sha256: prepared.contentHash },
  })

  const stored = await store.head(prepared.storageKey)
  if (stored.contentLength !== prepared.byteLength) {
    throw new Error('EVIDENCE_STORED_LENGTH_MISMATCH')
  }
  if (stored.contentType?.toLowerCase() !== prepared.representationMediaType) {
    throw new Error('EVIDENCE_STORED_MEDIA_TYPE_MISMATCH')
  }
  if (stored.metadata.sha256?.toLowerCase() !== prepared.contentHash) {
    throw new Error('EVIDENCE_STORED_HASH_MISMATCH')
  }

  return {
    byteLength: prepared.byteLength,
    contentHash: prepared.contentHash,
    storageKey: prepared.storageKey,
    representationMediaType: prepared.representationMediaType,
    retrievalAdapter: prepared.retrievalAdapter,
  }
}
