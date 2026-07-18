import { fetchJson, numberFromUnknown, objectRecord } from './types'

export const USGS_3DEP_EPQS_SOURCE_URL = 'https://epqs.nationalmap.gov/v1/json'

export async function fetchUsgsElevation(
  lat: number,
  lon: number,
  fetchImpl: typeof fetch = fetch,
): Promise<{ elevationFeet: number }> {
  const params = new URLSearchParams({
    x: String(lon), y: String(lat), units: 'Feet', wkid: '4326', includeDate: 'false',
  })

  try {
    const json = await fetchJson(`${USGS_3DEP_EPQS_SOURCE_URL}?${params.toString()}`, undefined, fetchImpl)
    const elevationFeet = numberFromUnknown(objectRecord(json).value)
    if (elevationFeet === undefined) throw new Error('Missing interpolated elevation value')
    return { elevationFeet }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown EPQS error'
    throw new Error(`USGS_3DEP_QUERY_FAILED: ${message}`)
  }
}
