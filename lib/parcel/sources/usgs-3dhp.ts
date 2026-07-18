import { fetchJson, objectRecord } from './types'

export const USGS_3DHP_SOURCE_URL = 'https://3dhp.nationalmap.gov/arcgis/rest/services/usgs_3dhp_all/FeatureServer'

const LAYERS = [
  { id: 50, featureType: 'FLOWLINE' },
  { id: 60, featureType: 'WATERBODY' },
] as const

export async function fetchUsgsHydrography(
  lat: number,
  lon: number,
  fetchImpl: typeof fetch = fetch,
): Promise<{ hydrography3dhpStatus: 'MAPPED_FEATURE' | 'NO_MAPPED_FEATURE'; hydrography3dhpFeatureTypes?: Array<'FLOWLINE' | 'WATERBODY'> }> {
  const featureTypes = await Promise.all(LAYERS.map(async ({ id, featureType }) => {
    const params = new URLSearchParams({
      f: 'json', geometry: `${lon},${lat}`, geometryType: 'esriGeometryPoint', inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects', outFields: '*', returnGeometry: 'false',
    })
    const json = await fetchJson(`${USGS_3DHP_SOURCE_URL}/${id}/query?${params.toString()}`, undefined, fetchImpl)
    const record = objectRecord(json)
    const error = objectRecord(record.error)
    if (Object.keys(error).length > 0) throw new Error(`USGS_3DHP_QUERY_FAILED: ${String(error.message ?? 'Unknown ArcGIS error')}`)
    return Array.isArray(record.features) && record.features.length > 0 ? featureType : undefined
  }))

  const mapped = featureTypes.filter((featureType): featureType is 'FLOWLINE' | 'WATERBODY' => featureType !== undefined)
  return mapped.length > 0
    ? { hydrography3dhpStatus: 'MAPPED_FEATURE', hydrography3dhpFeatureTypes: mapped }
    : { hydrography3dhpStatus: 'NO_MAPPED_FEATURE' }
}
