import type { ExitResult, ParcelProfile } from '@/lib/exit-engine/types'
import type { MaoResult } from '@/lib/mao/calculator'

export const PRE_PURCHASE_RESEARCH_SNAPSHOT_TTL_MS = 30 * 60 * 1000
export const PRE_PURCHASE_RESEARCH_SNAPSHOT_MAX_BYTES = 96_000

export type PrePurchaseResearchSnapshotPayload = {
  version: 1
  parcel: ParcelProfile
  results: ExitResult[]
  mao: MaoResult[]
  createdAt: string
}

export function prePurchaseResearchSnapshotPayload(
  parcel: ParcelProfile,
  results: ExitResult[],
  mao: MaoResult[],
  now = new Date(),
): PrePurchaseResearchSnapshotPayload {
  const payload = { version: 1 as const, parcel, results, mao, createdAt: now.toISOString() }
  if (Buffer.byteLength(JSON.stringify(payload), 'utf8') > PRE_PURCHASE_RESEARCH_SNAPSHOT_MAX_BYTES) {
    throw new Error('Pre-purchase research snapshot is too large to preserve safely.')
  }
  return payload
}

export function researchSnapshotJson(payload: PrePurchaseResearchSnapshotPayload) {
  return JSON.parse(JSON.stringify(payload)) as Record<string, unknown>
}

export function researchSnapshotExpiry(now = new Date()) {
  return new Date(now.getTime() + PRE_PURCHASE_RESEARCH_SNAPSHOT_TTL_MS)
}
