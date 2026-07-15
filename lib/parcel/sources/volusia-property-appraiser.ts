const VOLUSIA_FIPS = '12127'
const VOLUSIA_PARCELS_URL = 'https://maps5.vcgov.org/arcgis/rest/services/Basemap/MapServer/6/query'
const OUT_FIELDS = 'ALTKEY,PID,LANDACRES,LANDSQFT,PC,PC_DESC,BLDGCOUNT,RES_TOTAL_SFLA'

type FetchLike = typeof fetch

type Feature = {
  attributes?: Record<string, unknown>
  geometry?: { rings?: unknown }
}

export type OfficialParcelLocation = {
  lat: number
  lon: number
  sourceUrl: string
  retrievedAt: string
  parcelId: string
  alternateKey?: string
}

export class OfficialParcelLocationError extends Error {}

export function volusiaParcelQueryUrl(apn: string): string {
  const where = volusiaWhereClause(apn)
  if (!where) throw new OfficialParcelLocationError('VOLUSIA_PARCEL_IDENTIFIER_INVALID')

  const url = new URL(VOLUSIA_PARCELS_URL)
  url.searchParams.set('where', where)
  url.searchParams.set('outFields', OUT_FIELDS)
  url.searchParams.set('returnGeometry', 'true')
  url.searchParams.set('outSR', '4326')
  url.searchParams.set('resultRecordCount', '2')
  url.searchParams.set('f', 'json')
  return url.toString()
}

export async function resolveOfficialParcelLocation(
  input: { apn: string; fipsCounty: string },
  fetchImpl: FetchLike = fetch,
): Promise<OfficialParcelLocation | null> {
  if (input.fipsCounty !== VOLUSIA_FIPS) return null

  const sourceUrl = volusiaParcelQueryUrl(input.apn)
  let response: Response
  try {
    response = await fetchImpl(sourceUrl, { headers: { Accept: 'application/json' } })
  } catch {
    throw new OfficialParcelLocationError('VOLUSIA_PARCEL_SOURCE_UNAVAILABLE')
  }
  if (!response.ok) throw new OfficialParcelLocationError('VOLUSIA_PARCEL_SOURCE_UNAVAILABLE')

  const payload = await response.json() as { features?: unknown }
  const features = Array.isArray(payload.features) ? payload.features.filter(isFeature) : []
  if (features.length === 0) throw new OfficialParcelLocationError('VOLUSIA_PARCEL_NOT_FOUND')
  if (features.length > 1) throw new OfficialParcelLocationError('VOLUSIA_PARCEL_AMBIGUOUS')

  const feature = features[0]
  const center = polygonCenter(feature.geometry?.rings)
  const parcelId = stringValue(feature.attributes?.PID)
  if (!center || !parcelId) throw new OfficialParcelLocationError('VOLUSIA_PARCEL_LOCATION_UNRESOLVED')

  return {
    ...center,
    sourceUrl,
    retrievedAt: new Date().toISOString(),
    parcelId,
    alternateKey: stringValue(feature.attributes?.ALTKEY),
  }
}

function volusiaWhereClause(apn: string): string | null {
  const digits = apn.replace(/^0+/, '')
  if (/^\d{1,10}$/.test(digits)) return `ALTKEY=${Number(digits)}`
  if (/^[A-Z0-9]{1,30}$/.test(apn)) return `PID='${apn}'`
  return null
}

function polygonCenter(value: unknown): Pick<OfficialParcelLocation, 'lat' | 'lon'> | null {
  if (!Array.isArray(value)) return null
  const ring = value.map(parseRing).find((candidate): candidate is Array<{ x: number; y: number }> => candidate != null)
  if (!ring) return null

  let twiceArea = 0
  let lonSum = 0
  let latSum = 0
  for (let index = 0; index < ring.length - 1; index += 1) {
    const current = ring[index]
    const next = ring[index + 1]
    const cross = current.x * next.y - next.x * current.y
    twiceArea += cross
    lonSum += (current.x + next.x) * cross
    latSum += (current.y + next.y) * cross
  }
  if (Math.abs(twiceArea) < Number.EPSILON) return null

  const lon = lonSum / (3 * twiceArea)
  const lat = latSum / (3 * twiceArea)
  return Number.isFinite(lat) && lat >= -90 && lat <= 90 && Number.isFinite(lon) && lon >= -180 && lon <= 180
    ? { lat, lon }
    : null
}

function isFeature(value: unknown): value is Feature {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function parseRing(value: unknown): Array<{ x: number; y: number }> | null {
  if (!Array.isArray(value) || value.length < 4) return null
  const points = value.map(point => Array.isArray(point) && point.length >= 2 && isFiniteNumber(point[0]) && isFiniteNumber(point[1])
    ? { x: point[0], y: point[1] }
    : null)
  return points.every((point): point is { x: number; y: number } => point != null) ? points : null
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function stringValue(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return undefined
}
