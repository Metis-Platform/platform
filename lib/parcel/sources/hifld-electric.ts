import { fetchJson, objectRecord } from './types'

export const HIFLD_ELECTRIC_RETAIL_TERRITORIES_SOURCE_URL = 'https://services5.arcgis.com/HDRa0B57OVrv2E1q/ArcGIS/rest/services/Electric_Retail_Service_Territories/FeatureServer/0'

export async function fetchElectricUtility(
  lat: number,
  lon: number,
  fetchImpl: typeof fetch = fetch,
): Promise<{ hifldElectricTerritoryStatus: 'MAPPED_TERRITORY' | 'NO_MAPPED_TERRITORY_RETURNED'; hifldElectricUtilityNames?: string[]; hifldElectricServiceTypes?: string[] }> {
  const params = new URLSearchParams({ f: 'json', where: '1=1', geometry: `${lon},${lat}`, geometryType: 'esriGeometryPoint', inSR: '4326', spatialRel: 'esriSpatialRelIntersects', outFields: 'NAME,TYPE', returnGeometry: 'false' })
  const payload = objectRecord(await fetchJson(`${HIFLD_ELECTRIC_RETAIL_TERRITORIES_SOURCE_URL}/query?${params}`, undefined, fetchImpl))
  const features = Array.isArray(payload.features) ? payload.features : null
  if (!features) throw new Error('HIFLD_ELECTRIC_TERRITORY_QUERY_FAILED')
  const territories = features.map(feature => objectRecord(objectRecord(feature).attributes))
  const names = [...new Set(territories.map(({ NAME }) => typeof NAME === 'string' ? NAME.trim() : '').filter(Boolean))]
  const serviceTypes = [...new Set(territories.map(({ TYPE }) => typeof TYPE === 'string' ? TYPE.trim() : '').filter(Boolean))]
  return names.length > 0 ? { hifldElectricTerritoryStatus: 'MAPPED_TERRITORY', hifldElectricUtilityNames: names, ...(serviceTypes.length ? { hifldElectricServiceTypes: serviceTypes } : {}) } : { hifldElectricTerritoryStatus: 'NO_MAPPED_TERRITORY_RETURNED' }
}
