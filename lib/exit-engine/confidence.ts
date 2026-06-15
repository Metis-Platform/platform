import type { DataGap, ParcelFieldSource, ParcelProfile } from './types'

export interface ConfidenceInput {
  parcel: ParcelProfile
  hardFields: string[]
  softFields: string[]
}

const SOURCE_RELIABILITY: Record<string, number> = {
  fl_dor: 0.95,
  regrid: 0.95,
  ai_extracted: 0.8,
  manual: 0.65,
  unknown: 0.5,
}

const DEFAULT_TTL_DAYS = 180
const MS_PER_DAY = 1000 * 60 * 60 * 24

export function scoreConfidence(input: ConfidenceInput): {
  score: number
  gaps: DataGap[]
} {
  const hardGaps = input.hardFields
    .filter(field => !hasValue(input.parcel, field))
    .map(field => gap(field, 'HARD'))

  if (hardGaps.length > 0) {
    return { score: 0, gaps: hardGaps }
  }

  const relevantFields = [...input.hardFields, ...input.softFields]
  const softGaps = input.softFields
    .filter(field => !hasValue(input.parcel, field))
    .map(field => gap(field, 'SOFT'))
  const populatedCount = relevantFields.filter(field => hasValue(input.parcel, field)).length
  const completeness = relevantFields.length === 0 ? 1 : populatedCount / relevantFields.length
  const presentSources = relevantFields
    .filter(field => hasValue(input.parcel, field))
    .map(field => input.parcel.sources?.[field])
    .filter((source): source is ParcelFieldSource => source != null)
  const recency = scoreRecency(presentSources)
  const sourceReliability = scoreSourceReliability(presentSources)
  const score = completeness * 0.5 + recency * 0.3 + sourceReliability * 0.2

  return { score: Math.max(0, Math.min(1, score)), gaps: softGaps }
}

function hasValue(parcel: ParcelProfile, field: string): boolean {
  const value = field.split('.').reduce<unknown>((current, segment) => {
    if (current == null || typeof current !== 'object') return undefined
    return (current as Record<string, unknown>)[segment]
  }, parcel)

  return value !== undefined && value !== null && value !== ''
}

function gap(field: string, severity: DataGap['severity']): DataGap {
  return {
    field,
    severity,
    message: severity === 'HARD'
      ? `${field} is required to evaluate this exit.`
      : `${field} would improve confidence for this exit.`,
  }
}

function scoreRecency(sources: ParcelFieldSource[]): number {
  if (sources.length === 0) return 0.7

  const now = Date.now()
  let staleCount = 0
  let majorStaleCount = 0

  for (const source of sources) {
    const observedAt = source.observedAt ?? source.retrievedAt
    const ttlDays = source.ttlDays ?? (source.ttlHours == null ? DEFAULT_TTL_DAYS : source.ttlHours / 24)
    const ageDays = (now - observedAt.getTime()) / MS_PER_DAY
    if (ageDays > ttlDays * 2) majorStaleCount += 1
    else if (ageDays > ttlDays) staleCount += 1
  }

  if (majorStaleCount > 0) return 0.4
  if (staleCount > 0) return 0.7
  return 1
}

function scoreSourceReliability(sources: ParcelFieldSource[]): number {
  if (sources.length === 0) return 0.5

  return Math.min(...sources.map(source => SOURCE_RELIABILITY[source.provider] ?? SOURCE_RELIABILITY.unknown))
}
