import type { ParcelProfile } from '@/lib/exit-engine/types'
import { numberFromUnknown, objectRecord } from './types'
import { OfficialParcelLocationError } from './volusia-property-appraiser'

export const HARRIS_FIPS = '48201'
const HARRIS_PARCELS_URL = 'https://services.arcgis.com/su8ic9KbA7PYVxPS/arcgis/rest/services/Harris_County_Parcels/FeatureServer/1/query'
const OUT_FIELDS = 'HCAD_NUM,acreage_1,land_sqft,total_appraised_val'

type FetchLike = typeof fetch
type Feature = { attributes?: Record<string, unknown> }

export function harrisParcelQueryUrl(apn: string): string {
  if (!/^\d{13}$/.test(apn)) throw new OfficialParcelLocationError('HARRIS_PARCEL_IDENTIFIER_INVALID')

  const url = new URL(HARRIS_PARCELS_URL)
  url.searchParams.set('where', `HCAD_NUM='${apn}'`)
  url.searchParams.set('outFields', OUT_FIELDS)
  url.searchParams.set('returnGeometry', 'false')
  url.searchParams.set('resultRecordCount', '2')
  url.searchParams.set('f', 'json')
  return url.toString()
}

export async function fetchOfficialHarrisParcelFacts(
  input: { apn: string; fipsCounty: string },
  fetchImpl: FetchLike = fetch,
): Promise<Partial<ParcelProfile>> {
  if (input.fipsCounty !== HARRIS_FIPS) return {}

  const sourceUrl = harrisParcelQueryUrl(input.apn)
  let response: Response
  try {
    response = await fetchImpl(sourceUrl, { headers: { Accept: 'application/json' } })
  } catch {
    throw new OfficialParcelLocationError('HARRIS_PARCEL_SOURCE_UNAVAILABLE')
  }
  if (!response.ok) throw new OfficialParcelLocationError('HARRIS_PARCEL_SOURCE_UNAVAILABLE')

  let payload: Record<string, unknown>
  try {
    payload = objectRecord(await response.json())
  } catch {
    throw new OfficialParcelLocationError('HARRIS_PARCEL_SOURCE_UNAVAILABLE')
  }
  if (Object.keys(objectRecord(payload.error)).length > 0) {
    throw new OfficialParcelLocationError('HARRIS_PARCEL_SOURCE_UNAVAILABLE')
  }
  const features = Array.isArray(payload.features) ? payload.features.filter(isFeature) : []
  if (features.length === 0) throw new OfficialParcelLocationError('HARRIS_PARCEL_NOT_FOUND')
  if (features.length > 1) throw new OfficialParcelLocationError('HARRIS_PARCEL_AMBIGUOUS')

  return normalizeHarrisParcelAttributes(features[0].attributes ?? {})
}

export function normalizeHarrisParcelAttributes(attributes: Record<string, unknown>): Partial<ParcelProfile> {
  const lotSizeAcres = numberFromUnknown(attributes.acreage_1)
  return {
    lotSizeAcres,
    lotSizeSqFt: numberFromUnknown(attributes.land_sqft)
      ?? (lotSizeAcres == null ? undefined : lotSizeAcres * 43_560),
    assessedValue: numberFromUnknown(attributes.total_appraised_val),
  }
}

function isFeature(value: unknown): value is Feature {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}
