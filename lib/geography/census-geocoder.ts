const CENSUS_GEOCODER_URL = 'https://geocoding.geo.census.gov/geocoder/geographies/coordinates'
const CENSUS_ADDRESS_GEOCODER_URL = 'https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress'

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
  countyLandUseAuthorityStatus: 'UNRESOLVED' | 'VERIFIED'
  sourceUrl: string
  retrievedAt: string
}

export type CensusAddressLocation = GoverningGeography & {
  lat: number
  lon: number
  matchedAddress: string
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

export function censusAddressGeocoderUrl(address: string) {
  const url = new URL(CENSUS_ADDRESS_GEOCODER_URL)
  url.searchParams.set('address', address)
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
  return governingGeographyFromGeographies(payload.result?.geographies, sourceUrl)
}

export async function resolveCensusAddressLocation(
  address: string,
  fetchImpl: FetchLike = fetch,
): Promise<CensusAddressLocation> {
  const trimmed = address.trim()
  if (trimmed.length < 5 || trimmed.length > 256) throw new CensusGeocoderError('INVALID_ADDRESS')

  const sourceUrl = censusAddressGeocoderUrl(trimmed)
  let response: Response
  try {
    response = await fetchImpl(sourceUrl, { headers: { Accept: 'application/json' } })
  } catch {
    throw new CensusGeocoderError('CENSUS_ADDRESS_GEOCODER_UNAVAILABLE')
  }
  if (!response.ok) throw new CensusGeocoderError('CENSUS_ADDRESS_GEOCODER_UNAVAILABLE')

  const payload = await response.json() as { result?: { addressMatches?: unknown } }
  const matches = Array.isArray(payload.result?.addressMatches) ? payload.result.addressMatches.filter(isAddressMatch) : []
  if (matches.length === 0) throw new CensusGeocoderError('CENSUS_ADDRESS_UNRESOLVED')
  if (matches.length > 1) throw new CensusGeocoderError('CENSUS_ADDRESS_AMBIGUOUS')

  const match = matches[0]
  const lon = numberValue(match.coordinates?.x)
  const lat = numberValue(match.coordinates?.y)
  const matchedAddress = nonEmptyString(match.matchedAddress) ? match.matchedAddress : undefined
  if (lat == null || lon == null || !matchedAddress) throw new CensusGeocoderError('CENSUS_ADDRESS_UNRESOLVED')

  return {
    ...governingGeographyFromGeographies(match.geographies, sourceUrl),
    lat,
    lon,
    matchedAddress,
  }
}

function governingGeographyFromGeographies(
  geographies: Record<string, unknown> | undefined,
  sourceUrl: string,
): GoverningGeography {
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
    // Census place context alone cannot verify the governing zoning/planning authority.
    countyLandUseAuthorityStatus: 'UNRESOLVED',
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

type AddressMatch = {
  coordinates?: { x?: unknown; y?: unknown }
  matchedAddress?: unknown
  geographies?: Record<string, unknown>
}

function isAddressMatch(value: unknown): value is AddressMatch {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function isFips(value: unknown, length: number): value is string {
  return typeof value === 'string' && new RegExp(`^\\d{${length}}$`).test(value)
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}
