import { fetchJson, objectRecord } from './types'

export async function fetchFloodZone(lat: number, lon: number): Promise<{ floodZone: string; floodPanel: string }> {
  const params = new URLSearchParams({
    f: 'json',
    geometry: `${lon},${lat}`,
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: 'FLD_ZONE,FIRM_PAN',
    returnGeometry: 'false',
  })
  const json = await fetchJson(`https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query?${params.toString()}`)
  const record = objectRecord(json)
  const features = Array.isArray(record.features) ? record.features : []
  const attributes = objectRecord(objectRecord(features[0]).attributes)

  return {
    floodZone: String(attributes.FLD_ZONE ?? ''),
    floodPanel: String(attributes.FIRM_PAN ?? ''),
  }
}
