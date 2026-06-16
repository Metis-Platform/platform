import type { ParcelDataCache } from '@/app/generated/prisma'
import type { ParcelFieldSource, ParcelProfile } from '@/lib/exit-engine/types'

const HARD_PROFILE_FIELDS = [
  'lotSizeSqFt',
  'zoning',
  'floodZone',
  'improved',
  'irsLienPresent',
  'bankruptcyStay',
] as const

const CACHE_PROFILE_FIELDS = new Set([
  'lotSizeSqFt',
  'lotSizeAcres',
  'assessedValue',
  'assessedYear',
  'landUseCode',
  'improved',
  'marketValueEstimate',
  'zoning',
  'zoningDescription',
  'floodZone',
  'floodPanel',
  'brownfieldFlag',
  'undergroundTankFlag',
  'electricAvailable',
  'waterAvailable',
  'sewerAvailable',
  'gasAvailable',
  'irsLienPresent',
  'bankruptcyStay',
  'survivingLiens',
  'quietTitleRequired',
  'deedQuality',
  'conditionScore',
  'topography',
  'wetlandsAcres',
  'hoa',
])

export function assembleResearchProfile(
  apnNormalized: string,
  fipsCounty: string,
  state: string | undefined,
  county: string | undefined,
  cacheRows: ParcelDataCache[],
  overrides: Partial<ParcelProfile> = {},
): ParcelProfile {
  const now = new Date()

  const base: ParcelProfile = {
    apn: apnNormalized,
    apnRaw: apnNormalized,
    fipsCounty,
    state,
    county,
    dataCompleteness: 0,
    lastUpdated: now,
    sources: {},
  }

  const withCache = applyCacheFields(base, cacheRows)

  const overrideSources: Partial<Record<string, ParcelFieldSource>> = {}
  for (const key of Object.keys(overrides)) {
    if ((overrides as Record<string, unknown>)[key] !== undefined) {
      overrideSources[key] = { provider: 'manual', retrievedAt: now, ttlHours: 0 }
    }
  }

  const merged: ParcelProfile = {
    ...withCache,
    ...stripUndefined(overrides),
    sources: { ...withCache.sources, ...overrideSources },
  }

  const filled = HARD_PROFILE_FIELDS.filter(f => hasValue(merged[f])).length
  return { ...merged, dataCompleteness: filled / HARD_PROFILE_FIELDS.length }
}

function applyCacheFields(profile: ParcelProfile, cacheRows: ParcelDataCache[]): ParcelProfile {
  const now = Date.now()
  return cacheRows.reduce((next, row) => {
    if (row.ttlHours !== 0 && row.expiresAt.getTime() <= now) return next
    if (!CACHE_PROFILE_FIELDS.has(row.field)) return next
    const value = row.normalized ?? row.valueJson
    if (value == null) return next
    return {
      ...next,
      [row.field]: value,
      sources: {
        ...next.sources,
        [row.field]: fieldSource(row.source, row.retrievedAt, row.ttlHours),
      },
    }
  }, profile)
}

function fieldSource(provider: string, retrievedAt: Date, ttlHours: number): ParcelFieldSource {
  return { provider, retrievedAt, ttlHours }
}

function stripUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as Partial<T>
}

function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== ''
}
