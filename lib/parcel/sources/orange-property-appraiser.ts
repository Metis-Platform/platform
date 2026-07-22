import type { ParcelProfile } from '@/lib/exit-engine/types'
import { numberFromUnknown, objectRecord } from './types'
import { OfficialParcelLocationError, parcelInteriorPoint, type OfficialParcelLocation } from './volusia-property-appraiser'

export const ORANGE_FIPS = '12095'
const ORANGE_PARCELS_URL = 'https://vgispublic.ocpafl.org/server/rest/services/DynamicForJs/OCPA/MapServer/4/query'
const OUT_FIELDS = 'PARCEL,ACREAGE,TOTAL_ASSD,LAND_DOR_CODE,LIVING_AREA'

type FetchLike = typeof fetch
type Feature = { attributes?: Record<string, unknown>; geometry?: { rings?: unknown } }

export function orangeParcelQueryUrl(apn: string): string {
  if (!/^\d{10,15}$/.test(apn)) throw new OfficialParcelLocationError('ORANGE_PARCEL_IDENTIFIER_INVALID')

  const url = new URL(ORANGE_PARCELS_URL)
  url.searchParams.set('where', `PARCEL='${apn}'`)
  url.searchParams.set('outFields', OUT_FIELDS)
  url.searchParams.set('returnGeometry', 'true')
  url.searchParams.set('outSR', '4326')
  url.searchParams.set('resultRecordCount', '2')
  url.searchParams.set('f', 'json')
  return url.toString()
}

export async function resolveOrangeOfficialParcelLocation(
  input: { apn: string; fipsCounty: string },
  fetchImpl: FetchLike = fetch,
): Promise<OfficialParcelLocation | null> {
  if (input.fipsCounty !== ORANGE_FIPS) return null

  const { feature, sourceUrl } = await fetchOfficialOrangeParcelFeature(input.apn, fetchImpl)
  const center = parcelInteriorPoint(feature.geometry?.rings)
  const parcelId = stringValue(feature.attributes?.PARCEL)
  if (!center || !parcelId) throw new OfficialParcelLocationError('ORANGE_PARCEL_LOCATION_UNRESOLVED')

  return { ...center, sourceUrl, retrievedAt: new Date().toISOString(), parcelId }
}

export async function fetchOfficialOrangeParcelFacts(
  input: { apn: string; fipsCounty: string },
  fetchImpl: FetchLike = fetch,
): Promise<Partial<ParcelProfile>> {
  if (input.fipsCounty !== ORANGE_FIPS) return {}
  const { feature } = await fetchOfficialOrangeParcelFeature(input.apn, fetchImpl)
  return normalizeOrangeParcelAttributes(feature.attributes ?? {})
}

export function normalizeOrangeParcelAttributes(attributes: Record<string, unknown>): Partial<ParcelProfile> {
  const lotSizeAcres = numberFromUnknown(attributes.ACREAGE)
  const livingArea = numberFromUnknown(attributes.LIVING_AREA)

  return {
    lotSizeAcres,
    lotSizeSqFt: lotSizeAcres == null ? undefined : lotSizeAcres * 43_560,
    assessedValue: numberFromUnknown(attributes.TOTAL_ASSD),
    landUseCode: stringValue(attributes.LAND_DOR_CODE),
    improved: livingArea == null ? undefined : livingArea > 0 ? true : undefined,
  }
}

async function fetchOfficialOrangeParcelFeature(apn: string, fetchImpl: FetchLike): Promise<{ feature: Feature; sourceUrl: string }> {
  const sourceUrl = orangeParcelQueryUrl(apn)
  let response: Response
  try {
    response = await fetchImpl(sourceUrl, { headers: { Accept: 'application/json' } })
  } catch {
    throw new OfficialParcelLocationError('ORANGE_PARCEL_SOURCE_UNAVAILABLE')
  }
  if (!response.ok) throw new OfficialParcelLocationError('ORANGE_PARCEL_SOURCE_UNAVAILABLE')

  let payload: Record<string, unknown>
  try {
    payload = objectRecord(await response.json())
  } catch {
    throw new OfficialParcelLocationError('ORANGE_PARCEL_SOURCE_UNAVAILABLE')
  }
  if (Object.keys(objectRecord(payload.error)).length > 0) {
    throw new OfficialParcelLocationError('ORANGE_PARCEL_SOURCE_UNAVAILABLE')
  }

  const features = Array.isArray(payload.features) ? payload.features.filter(isFeature) : []
  if (features.length === 0) throw new OfficialParcelLocationError('ORANGE_PARCEL_NOT_FOUND')
  if (features.length > 1) throw new OfficialParcelLocationError('ORANGE_PARCEL_AMBIGUOUS')
  return { feature: features[0], sourceUrl }
}

function isFeature(value: unknown): value is Feature {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function stringValue(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return undefined
}
