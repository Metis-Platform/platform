const VOLUSIA_FIPS = '12127'
const VOLUSIA_PARCELS_URL = 'https://maps5.vcgov.org/arcgis/rest/services/Basemap/MapServer/6/query'
const OUT_FIELDS = 'ALTKEY,PID,LANDACRES,LANDSQFT,PC,PC_DESC,BLDGCOUNT,RES_TOTAL_SFLA'

type FetchLike = typeof fetch

type Feature = {
  attributes?: Record<string, unknown>
  geometry?: { rings?: unknown }
}

type Point = { x: number; y: number }

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
  const center = parcelInteriorPoint(feature.geometry?.rings)
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

export function parcelInteriorPoint(value: unknown): Pick<OfficialParcelLocation, 'lat' | 'lon'> | null {
  if (!Array.isArray(value)) return null
  const rings = value.map(parseRing).filter((ring): ring is Point[] => ring != null)
  if (rings.length === 0) return null
  const outer = rings.reduce((largest, ring) => Math.abs(signedArea(ring)) > Math.abs(signedArea(largest)) ? ring : largest)
  if (Math.abs(signedArea(outer)) < Number.EPSILON) return null
  const holes = rings.filter(ring => ring !== outer && pointInRing(ring[0], outer))
  const candidates = [polygonCentroid(outer), ...scanlineCandidates(outer)]

  for (const candidate of candidates) {
    if (candidate && pointInRing(candidate, outer) && !holes.some(hole => pointInRing(candidate, hole))) {
      return { lat: candidate.y, lon: candidate.x }
    }
  }
  return null
}

function polygonCentroid(ring: Point[]): Point | null {
  let twiceArea = 0
  let xSum = 0
  let ySum = 0
  for (let index = 0; index < ring.length; index += 1) {
    const current = ring[index]
    const next = ring[(index + 1) % ring.length]
    const cross = current.x * next.y - next.x * current.y
    twiceArea += cross
    xSum += (current.x + next.x) * cross
    ySum += (current.y + next.y) * cross
  }
  if (Math.abs(twiceArea) < Number.EPSILON) return null

  const x = xSum / (3 * twiceArea)
  const y = ySum / (3 * twiceArea)
  return Number.isFinite(y) && y >= -90 && y <= 90 && Number.isFinite(x) && x >= -180 && x <= 180
    ? { x, y }
    : null
}

function scanlineCandidates(ring: Point[]): Point[] {
  const ys = ring.map(point => point.y)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  if (minY === maxY) return []
  const yValues = [0.5, 0.25, 0.75, 0.125, 0.375, 0.625, 0.875]
    .map(fraction => minY + (maxY - minY) * fraction)

  return yValues.flatMap(y => {
    const intersections: number[] = []
    for (let index = 0; index < ring.length; index += 1) {
      const a = ring[index]
      const b = ring[(index + 1) % ring.length]
      if ((a.y > y) === (b.y > y)) continue
      intersections.push(a.x + (y - a.y) * (b.x - a.x) / (b.y - a.y))
    }
    intersections.sort((a, b) => a - b)
    const segments: Point[] = []
    for (let index = 0; index + 1 < intersections.length; index += 2) {
      segments.push({ x: (intersections[index] + intersections[index + 1]) / 2, y })
    }
    return segments
  })
}

function signedArea(ring: Point[]): number {
  return ring.reduce((total, point, index) => {
    const next = ring[(index + 1) % ring.length]
    return total + point.x * next.y - next.x * point.y
  }, 0) / 2
}

function pointInRing(point: Point, ring: Point[]): boolean {
  let inside = false
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
    const current = ring[index]
    const prior = ring[previous]
    if ((current.y > point.y) !== (prior.y > point.y)
      && point.x < (prior.x - current.x) * (point.y - current.y) / (prior.y - current.y) + current.x) {
      inside = !inside
    }
  }
  return inside
}

function isFeature(value: unknown): value is Feature {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function parseRing(value: unknown): Point[] | null {
  if (!Array.isArray(value) || value.length < 4) return null
  const points = value.map(point => Array.isArray(point) && point.length >= 2 && isFiniteNumber(point[0]) && isFiniteNumber(point[1])
    ? { x: point[0], y: point[1] }
    : null)
  return points.every((point): point is Point => point != null) ? points : null
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function stringValue(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return undefined
}
