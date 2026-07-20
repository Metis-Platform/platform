import { fetchJson, objectRecord } from './types'

export const USGS_PADUS_FEDERAL_FEE_SOURCE_URL = 'https://services.arcgis.com/v01gqwM5QqNysAAi/arcgis/rest/services/Federal_Fee_Managers_Authoritative_PADUS/FeatureServer/0'

export async function fetchPadusFederalFeeManagers(
  lat: number,
  lon: number,
  fetchImpl: typeof fetch = fetch,
): Promise<{
  padusFederalFeeStatus: 'MAPPED_FEATURE' | 'NO_MAPPED_FEATURE'
  padusFederalFeeManagerNames?: string[]
}> {
  const params = new URLSearchParams({
    f: 'json', geometry: `${lon},${lat}`, geometryType: 'esriGeometryPoint', inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects', outFields: 'Mang_Name', returnGeometry: 'false',
  })
  const json = await fetchJson(`${USGS_PADUS_FEDERAL_FEE_SOURCE_URL}/query?${params.toString()}`, undefined, fetchImpl)
  const record = objectRecord(json)
  const error = objectRecord(record.error)
  if (Object.keys(error).length > 0) throw new Error(`USGS_PADUS_QUERY_FAILED: ${String(error.message ?? 'Unknown ArcGIS error')}`)

  const managerNames = Array.isArray(record.features)
    ? [...new Set(record.features.flatMap(feature => {
      const name = objectRecord(objectRecord(feature).attributes).Mang_Name
      return typeof name === 'string' && name.trim() !== '' ? [name.trim()] : []
    }))]
    : []

  return managerNames.length > 0
    ? { padusFederalFeeStatus: 'MAPPED_FEATURE', padusFederalFeeManagerNames: managerNames }
    : { padusFederalFeeStatus: 'NO_MAPPED_FEATURE' }
}
