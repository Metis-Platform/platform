import type { ParcelFieldSource } from '@/lib/exit-engine/types'

export type ParcelFactProvenance = 'OFFICIAL' | 'ESTIMATED' | 'MANUAL' | 'UNVERIFIED' | 'MISSING'

const OFFICIAL_PROVIDERS = new Set(['fl_dor', 'fema_nfhl', 'epa_echo', 'usgs_3dep', 'usgs_3dhp', 'volusia_property_appraiser', 'volusia_arcgis'])

export function parcelFactProvenance(
  field: string,
  source: ParcelFieldSource | undefined,
  value: unknown,
): ParcelFactProvenance {
  if (value === undefined || value === null || value === '') return 'MISSING'
  if (source?.provider === 'manual') return 'MANUAL'
  if (field === 'marketValueEstimate') return 'ESTIMATED'
  if (source && OFFICIAL_PROVIDERS.has(source.provider)) return 'OFFICIAL'
  return 'UNVERIFIED'
}

export const PARCEL_FACT_PROVENANCE_LABEL: Record<ParcelFactProvenance, string> = {
  OFFICIAL: 'Official source',
  ESTIMATED: 'Estimated',
  MANUAL: 'Manually entered',
  UNVERIFIED: 'Source not verified',
  MISSING: 'Missing',
}

export function parcelFactTimestampLabel(source: ParcelFieldSource | undefined): string | undefined {
  if (!source) return undefined
  const timestamp = new Date(source.retrievedAt)
  if (Number.isNaN(timestamp.getTime())) return undefined
  const verb = source.provider === 'manual' ? 'Recorded' : 'Retrieved'
  return `${verb} ${timestamp.toISOString().slice(0, 10)}`
}
