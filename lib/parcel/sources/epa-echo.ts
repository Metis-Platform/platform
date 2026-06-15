import { fetchJson, objectRecord } from './types'

export async function fetchEpaFlags(
  lat: number,
  lon: number,
  radiusMiles = 1,
): Promise<{
  brownfieldFlag: boolean
  undergroundTankFlag: boolean
  superfundProximity: boolean
  facilities: string[]
}> {
  const params = new URLSearchParams({
    output: 'JSON',
    p_lat: String(lat),
    p_long: String(lon),
    p_radius: String(radiusMiles),
  })
  const json = await fetchJson(`https://echodata.epa.gov/echo/cwa_rest_services.get_facilities?${params.toString()}`)
  const record = objectRecord(json)
  const results = objectRecord(record.Results)
  const facilities = Array.isArray(results.Facilities) ? results.Facilities : []
  const names = facilities
    .map(facility => objectRecord(facility).FacName)
    .filter((name): name is string => typeof name === 'string')

  return {
    brownfieldFlag: false,
    undergroundTankFlag: false,
    superfundProximity: names.length > 0,
    facilities: names,
  }
}
