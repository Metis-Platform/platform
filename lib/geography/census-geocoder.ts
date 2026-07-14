const CENSUS_GEOCODER_URL = 'https://geocoding.geo.census.gov/geocoder/geographies/coordinates'

type FetchLike = typeof fetch

type Geography = {
  GEOID?: unknown
  NAME?: unknown
  STATE?: unknown
}

export type GoverningGeography = {
  countyFips: string
  countyName: string
  stateFips?: string
  incorporatedPlace?: { geoid: string; name: string }
  municipalityStatus: 'INCORPORATED_PLACE' | 'NO_INCORPORATED_PLACE_RETURNED'
  sourceUrl: string
  retrievedAt: string
}

export class CensusGeocoderError extends Error {}

export function censusGeocoderUrl(lat: number, lon: number) {
  const url = new URL(CENSUS_GEOCODER_URL)
  url.searchParams.set('x', String(lon))
  url.searchParams.set('y', String(lat))
  url.searchParams.set('benchmark', 'Public_AR_Current')
  url.searchParams.set('vintage', 'Current_Current')
  url.searchParams.set('format', 'json')
  return url.toString()
}

export async function resolveGoverningGeography(
  input: { lat: number; lon: number },
  fetchImpl: FetchLike = fetch,
): Promise<GoverningGeography> {
  if (!Number.isFinite(input.lat) || input.lat < -90 || input.lat > 90) throw new CensusGeocoderError('INVALID_LATITUDE')
  if (!Number.isFinite(input.lon) || input.lon < -180 || input.lon > 180) throw new CensusGeocoderError('INVALID_LONGITUDE')

  const sourceUrl = censusGeocoderUrl(input.lat, input.lon)
  let response: Response
  try {
    response = await fetchImpl(sourceUrl, { headers: { Accept: 'application/json' } })
  } catch {
    throw new CensusGeocoderError('CENSUS_GEOCODER_UNAVAILABLE')
  }
  if (!response.ok) throw new CensusGeocoderError('CENSUS_GEOCODER_UNAVAILABLE')

  const payload = await response.json() as { result?: { geographies?: Record<string, unknown> } }
  const geographies = payload.result?.geographies
  const county = firstGeography(geographies?.Counties)
  if (!county || !isFips(county.GEOID, 5) || !nonEmptyString(county.NAME)) {
    throw new CensusGeocoderError('CENSUS_COUNTY_UNRESOLVED')
  }
  const place = firstGeography(geographies?.['Incorporated Places'])
  const incorporatedPlace = place && isFips(place.GEOID, 7) && nonEmptyString(place.NAME)
    ? { geoid: place.GEOID, name: place.NAME }
    : undefined

  return {
    countyFips: county.GEOID,
    countyName: county.NAME,
    stateFips: isFips(county.STATE, 2) ? county.STATE : undefined,
    incorporatedPlace,
    // A missing incorporated-place layer is not proof that a parcel is governed by county rules.
    municipalityStatus: incorporatedPlace ? 'INCORPORATED_PLACE' : 'NO_INCORPORATED_PLACE_RETURNED',
    sourceUrl,
    retrievedAt: new Date().toISOString(),
  }
}

function firstGeography(value: unknown): Geography | undefined {
  return Array.isArray(value) && value.length > 0 && isRecord(value[0]) ? value[0] : undefined
}

function isRecord(value: unknown): value is Geography {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function isFips(value: unknown, length: number): value is string {
  return typeof value === 'string' && new RegExp(`^\\d{${length}}$`).test(value)
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}
