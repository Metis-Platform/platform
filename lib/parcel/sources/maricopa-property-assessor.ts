import { OfficialParcelLocationError, parcelInteriorPoint, type OfficialParcelLocation } from './volusia-property-appraiser'

const MARICOPA_FIPS = '04013'
const MARICOPA_PARCELS_URL = 'https://gis.mcassessor.maricopa.gov/arcgis/rest/services/Parcels/MapServer/0/query'
const OUT_FIELDS = 'APN,JURISDICTION,CITY_ZONING'

type FetchLike = typeof fetch
type Feature = { attributes?: Record<string, unknown>; geometry?: { rings?: unknown } }

export function maricopaParcelQueryUrl(apn: string): string {
  if (!/^\d{8,10}$/.test(apn)) throw new OfficialParcelLocationError('MARICOPA_PARCEL_IDENTIFIER_INVALID')
  const url = new URL(MARICOPA_PARCELS_URL)
  url.searchParams.set('where', `APN='${apn}'`)
  url.searchParams.set('outFields', OUT_FIELDS)
  url.searchParams.set('returnGeometry', 'true')
  url.searchParams.set('outSR', '4326')
  url.searchParams.set('resultRecordCount', '2')
  url.searchParams.set('f', 'json')
  return url.toString()
}

export async function resolveMaricopaOfficialParcelLocation(
  input: { apn: string; fipsCounty: string },
  fetchImpl: FetchLike = fetch,
): Promise<OfficialParcelLocation | null> {
  if (input.fipsCounty !== MARICOPA_FIPS) return null
  const sourceUrl = maricopaParcelQueryUrl(input.apn)
  let response: Response
  try {
    response = await fetchImpl(sourceUrl, { headers: { Accept: 'application/json' } })
  } catch {
    throw new OfficialParcelLocationError('MARICOPA_PARCEL_SOURCE_UNAVAILABLE')
  }
  if (!response.ok) throw new OfficialParcelLocationError('MARICOPA_PARCEL_SOURCE_UNAVAILABLE')

  const payload = await response.json() as { features?: unknown }
  const features = Array.isArray(payload.features) ? payload.features.filter(isFeature) : []
  if (features.length === 0) throw new OfficialParcelLocationError('MARICOPA_PARCEL_NOT_FOUND')
  if (features.length > 1) throw new OfficialParcelLocationError('MARICOPA_PARCEL_AMBIGUOUS')

  const feature = features[0]
  const center = parcelInteriorPoint(feature.geometry?.rings)
  const parcelId = stringValue(feature.attributes?.APN)
  if (!center || !parcelId) throw new OfficialParcelLocationError('MARICOPA_PARCEL_LOCATION_UNRESOLVED')
  return { ...center, sourceUrl, retrievedAt: new Date().toISOString(), parcelId }
}

function isFeature(value: unknown): value is Feature {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function stringValue(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return undefined
}
