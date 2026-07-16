import { fetchJson, objectRecord } from './types'

export const FWS_NWI_SOURCE_URL = 'https://fwspublicservices.wim.usgs.gov/wetlandsmapservice/rest/services/Wetlands/MapServer/0'

export async function fetchNwiWetlands(
  lat: number,
  lon: number,
  fetchImpl: typeof fetch = fetch,
): Promise<{ wetlandsPresent?: true; wetlandsNwiStatus: 'MAPPED_FEATURE' | 'NO_MAPPED_FEATURE' }> {
  const params = new URLSearchParams({
    f: 'json', geometry: `${lon},${lat}`, geometryType: 'esriGeometryPoint', inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects', outFields: 'ATTRIBUTE', returnGeometry: 'false',
  })
  const json = await fetchJson(`${FWS_NWI_SOURCE_URL}/query?${params.toString()}`, undefined, fetchImpl)
  const record = objectRecord(json)
  const error = objectRecord(record.error)
  if (Object.keys(error).length > 0) throw new Error(`FWS_NWI_QUERY_FAILED: ${String(error.message ?? 'Unknown ArcGIS error')}`)
  const features = Array.isArray(record.features) ? record.features : []
  return features.length > 0
    ? { wetlandsPresent: true, wetlandsNwiStatus: 'MAPPED_FEATURE' }
    : { wetlandsNwiStatus: 'NO_MAPPED_FEATURE' }
}
