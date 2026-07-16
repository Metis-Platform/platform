import { fetchJson, objectRecord } from './types'

export const EPA_ECHO_CWA_SOURCE_URL = 'https://echodata.epa.gov/echo/cwa_rest_services.get_facilities'

export async function fetchEpaFlags(
  lat: number,
  lon: number,
  radiusMiles = 1,
  fetchImpl: typeof fetch = fetch,
): Promise<{
  epaCwaFacilitySearchStatus: 'FACILITY_FOUND' | 'NO_FACILITY_RETURNED'
  epaCwaFacilityNames?: string[]
}> {
  const params = new URLSearchParams({
    output: 'JSON',
    p_lat: String(lat),
    p_long: String(lon),
    p_radius: String(radiusMiles),
  })
  const json = await fetchJson(`${EPA_ECHO_CWA_SOURCE_URL}?${params.toString()}`, undefined, fetchImpl)
  const record = objectRecord(json)
  const results = objectRecord(record.Results)
  if (Object.keys(results).length === 0) throw new Error('EPA_ECHO_CWA_QUERY_FAILED: Missing facility search results')
  const facilities = Array.isArray(results.Facilities) ? results.Facilities : []
  const names = facilities
    .map(facility => objectRecord(facility).FacName)
    .filter((name): name is string => typeof name === 'string')

  return {
    epaCwaFacilitySearchStatus: names.length > 0 ? 'FACILITY_FOUND' : 'NO_FACILITY_RETURNED',
    ...(names.length > 0 ? { epaCwaFacilityNames: names } : {}),
  }
}
