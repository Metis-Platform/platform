import { fetchJson, objectRecord } from './types'

export const FEMA_NFHL_SOURCE_URL = 'https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer'

export async function fetchFloodZone(
  lat: number,
  lon: number,
  fetchImpl: typeof fetch = fetch,
): Promise<{ floodZone?: string; floodPanel?: string }> {
  const [zoneJson, panelJson] = await Promise.all([
    fetchJson(femaQueryUrl(28, lat, lon, 'FLD_ZONE'), undefined, fetchImpl),
    fetchJson(femaQueryUrl(3, lat, lon, 'FIRM_PAN'), undefined, fetchImpl),
  ])

  const floodZone = uniqueFeatureValue(zoneJson, 'FLD_ZONE')
  const floodPanel = uniqueFeatureValue(panelJson, 'FIRM_PAN')

  return {
    ...(floodZone ? { floodZone } : {}),
    ...(floodPanel ? { floodPanel } : {}),
  }
}

function femaQueryUrl(layer: number, lat: number, lon: number, outFields: string): string {
  const params = new URLSearchParams({
    f: 'json',
    geometry: `${lon},${lat}`,
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields,
    returnGeometry: 'false',
  })
  return `${FEMA_NFHL_SOURCE_URL}/${layer}/query?${params.toString()}`
}

function uniqueFeatureValue(json: unknown, field: string): string | undefined {
  const record = objectRecord(json)
  const arcGisError = objectRecord(record.error)
  if (Object.keys(arcGisError).length > 0) {
    throw new Error(`FEMA_NFHL_QUERY_FAILED: ${String(arcGisError.message ?? 'Unknown ArcGIS error')}`)
  }

  const features = Array.isArray(record.features) ? record.features : []
  const values = features
    .map(feature => objectRecord(objectRecord(feature).attributes)[field])
    .filter((value): value is string => typeof value === 'string' && value.trim() !== '')
    .map(value => value.trim())
  const uniqueValues = [...new Set(values)]

  if (uniqueValues.length > 1) throw new Error(`FEMA_NFHL_AMBIGUOUS_${field}`)
  return uniqueValues[0]
}
