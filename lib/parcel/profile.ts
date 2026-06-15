import type { Deal, DealLand, Jurisdiction, Property } from '@/app/generated/prisma'
import { normalizeApn } from './apn'
import type { ParcelFieldSource, ParcelProfile } from '@/lib/exit-engine/types'

export interface ParcelDataCache {
  provider?: string
  retrievedAt?: Date
  ttlHours?: number
  data?: unknown
}

type DealWithParcel = Deal & {
  property: Property & { jurisdiction: Jurisdiction | null }
  land: DealLand | null
}

const HARD_PROFILE_FIELDS = [
  'lotSizeSqFt',
  'zoning',
  'floodZone',
  'improved',
  'irsLienPresent',
  'bankruptcyStay',
] as const

export function assembleParcelProfile(
  deal: DealWithParcel,
  cacheRows: ParcelDataCache[],
): ParcelProfile {
  const property = deal.property
  const fipsCounty = property.jurisdiction?.fips ?? ''
  const normalizedApn = normalizeApn(property.apn, fipsCounty)
  const sources = buildSources(property.updatedAt, deal.land?.updatedAt, cacheRows)
  const lotSizeAcres = decimalToNumber(property.acres)
  const lotSizeSqFt = property.sqft ?? (lotSizeAcres == null ? undefined : lotSizeAcres * 43560)
  const assessedValue = decimalToNumber(property.assessedValue)
  const improved = property.sqft == null ? undefined : property.sqft > 0
  const utilities = readUtilities(deal.land?.utilities)
  const wetlandsPercent = decimalToNumber(deal.land?.wetlandsPercent)
  const acreage = lotSizeAcres ?? 0

  const profile: ParcelProfile = {
    apn: normalizedApn.normalized,
    apnRaw: normalizedApn.raw,
    fipsCounty,
    state: property.state ?? property.jurisdiction?.state,
    county: property.jurisdiction?.county,
    lotSizeSqFt,
    lotSizeAcres,
    improved,
    zoning: deal.land?.zoning ?? undefined,
    floodZone: deal.land?.floodZone ?? undefined,
    wetlandsPresent: wetlandsPercent == null ? undefined : wetlandsPercent > 0,
    wetlandsAcres: wetlandsPercent == null || acreage === 0 ? undefined : acreage * (wetlandsPercent / 100),
    hoa: deal.land?.hoaName || deal.land?.hoaFees
      ? {
          present: true,
          monthlyFee: decimalToNumber(deal.land.hoaFees),
        }
      : undefined,
    waterAvailable: utilities.water,
    sewerAvailable: utilities.sewer,
    electricAvailable: utilities.electric,
    gasAvailable: utilities.gas,
    utilitiesNotes: utilities.notes,
    roadFrontage: mapAccess(deal.land?.access),
    assessedValue,
    structureSqFt: property.sqft ?? undefined,
    bedroomCount: property.beds ?? undefined,
    purchasePrice: decimalToNumber(deal.purchasePrice),
    dataCompleteness: 0,
    lastUpdated: maxDate(property.updatedAt, deal.updatedAt, deal.land?.updatedAt),
    sources,
  }

  return {
    ...profile,
    dataCompleteness: calculateParcelCompleteness(profile),
  }
}

export function calculateParcelCompleteness(parcel: Pick<ParcelProfile, typeof HARD_PROFILE_FIELDS[number]>): number {
  const populated = HARD_PROFILE_FIELDS.filter(field => hasValue(parcel[field])).length
  return populated / HARD_PROFILE_FIELDS.length
}

function decimalToNumber(value: { toString(): string } | number | null | undefined): number | undefined {
  if (value == null) return undefined
  const numberValue = typeof value === 'number' ? value : Number(value.toString())
  return Number.isFinite(numberValue) ? numberValue : undefined
}

function buildSources(
  propertyUpdatedAt: Date,
  landUpdatedAt: Date | undefined,
  cacheRows: ParcelDataCache[],
): Partial<Record<string, ParcelFieldSource>> {
  const manualProperty = source('manual', propertyUpdatedAt)
  const manualLand = source('manual', landUpdatedAt ?? propertyUpdatedAt)
  const sources: Partial<Record<string, ParcelFieldSource>> = {
    apn: manualProperty,
    lotSizeSqFt: manualProperty,
    lotSizeAcres: manualProperty,
    improved: manualProperty,
    assessedValue: manualProperty,
    zoning: manualLand,
    floodZone: manualLand,
    wetlandsPresent: manualLand,
    roadFrontage: manualLand,
  }

  const newestCache = cacheRows
    .filter(row => row.retrievedAt)
    .sort((a, b) => b.retrievedAt!.getTime() - a.retrievedAt!.getTime())[0]

  if (newestCache?.retrievedAt) {
    sources.marketValueEstimate = source(newestCache.provider ?? 'unknown', newestCache.retrievedAt, newestCache.ttlHours)
  }

  return sources
}

function source(provider: string, retrievedAt: Date, ttlHours = 24 * 180): ParcelFieldSource {
  return {
    provider,
    retrievedAt,
    ttlHours,
    observedAt: retrievedAt,
    ttlDays: ttlHours / 24,
  }
}

function readUtilities(value: unknown): {
  water?: boolean
  sewer?: boolean
  electric?: boolean
  gas?: boolean
  notes?: string
} {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return {}
  const record = value as Record<string, unknown>

  return {
    water: readBoolean(record.water),
    sewer: readBoolean(record.sewer),
    electric: readBoolean(record.electric),
    gas: readBoolean(record.gas),
    notes: typeof record.notes === 'string' ? record.notes : undefined,
  }
}

function readBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

function mapAccess(access: DealLand['access'] | null | undefined): ParcelProfile['roadFrontage'] {
  switch (access) {
    case 'ROAD':
      return 'paved'
    case 'EASEMENT':
      return 'easement_only'
    case 'LANDLOCKED':
    case 'NONE':
      return 'landlocked'
    default:
      return undefined
  }
}

function maxDate(...dates: Array<Date | null | undefined>): Date {
  return new Date(Math.max(...dates.filter((date): date is Date => date != null).map(date => date.getTime())))
}

function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== ''
}
