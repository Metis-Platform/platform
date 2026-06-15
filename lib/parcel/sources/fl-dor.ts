import type { ParcelProfile } from '@/lib/exit-engine/types'
import { booleanFromUnknown, numberFromUnknown, objectRecord } from './types'

export async function fetchFlDorParcel(apn: string, fipsCounty: string): Promise<Partial<ParcelProfile>> {
  if (!fipsCounty.startsWith('12')) return {}

  // FL DOR county parcel data is not exposed through one stable statewide JSON endpoint.
  // This adapter is intentionally normalization-only until #233/#238 provide county-specific source URLs.
  return normalizeFlDorAttributes({ PARCEL_ID: apn, FIPS: fipsCounty })
}

export function normalizeFlDorAttributes(attributes: Record<string, unknown>): Partial<ParcelProfile> {
  const lotSizeAcres = numberFromUnknown(attributes.ACRES ?? attributes.acres)
  const lotSizeSqFt = numberFromUnknown(attributes.SQFT ?? attributes.sqft)
    ?? (lotSizeAcres == null ? undefined : lotSizeAcres * 43560)
  const assessedValue = numberFromUnknown(attributes.ASSESSED_VALUE ?? attributes.assessedValue)
  const assessedYear = numberFromUnknown(attributes.TAX_YEAR ?? attributes.assessedYear)
  const landUseCode = typeof attributes.LAND_USE_CODE === 'string'
    ? attributes.LAND_USE_CODE
    : typeof attributes.landUseCode === 'string'
      ? attributes.landUseCode
      : undefined
  const improved = booleanFromUnknown(attributes.IMPROVED ?? attributes.improved)

  return {
    lotSizeSqFt,
    lotSizeAcres,
    assessedValue,
    assessedYear,
    landUseCode,
    improved,
    marketValueEstimate: numberFromUnknown(attributes.MARKET_VALUE ?? attributes.marketValueEstimate),
  }
}

export function flDorRaw(attributes: unknown): Record<string, unknown> {
  return objectRecord(attributes)
}
