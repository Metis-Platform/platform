import { fetchJson, objectRecord } from './types'

export const USDA_SSURGO_SOURCE_URL = 'https://SDMDataAccess.sc.egov.usda.gov/Tabular/post.rest'

export interface SsurgoMapUnit {
  soilMapUnitKey: string
  soilMapUnitName: string
  soilFarmlandClassification?: string
}

export async function fetchSsurgoMapUnit(
  lat: number,
  lon: number,
  fetchImpl: typeof fetch = fetch,
): Promise<SsurgoMapUnit | undefined> {
  const query = [
    'SELECT mukey AS mukey, muname AS map_unit_name, farmlndcl AS farmland_classification',
    'FROM mapunit',
    `WHERE mukey IN (SELECT * FROM SDA_Get_Mukey_from_intersection_with_WktWgs84('point (${lon} ${lat})'))`,
  ].join(' ')
  const body = new URLSearchParams({ format: 'JSON+COLUMNNAME', query })
  const json = await fetchJson(USDA_SSURGO_SOURCE_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  }, fetchImpl)
  const record = objectRecord(json)
  const error = objectRecord(record.Error ?? record.error)
  if (Object.keys(error).length > 0) throw new Error(`USDA_SSURGO_QUERY_FAILED: ${String(error.message ?? error.Message ?? 'Unknown Soil Data Access error')}`)

  const table = Array.isArray(record.Table) ? record.Table : []
  const [header, row] = table
  if (!Array.isArray(header) || !Array.isArray(row)) return undefined
  const mukeyIndex = header.indexOf('mukey')
  const nameIndex = header.indexOf('map_unit_name')
  const farmlandClassificationIndex = header.indexOf('farmland_classification')
  const mukey = row[mukeyIndex]
  const name = row[nameIndex]
  const farmlandClassification = row[farmlandClassificationIndex]
  if (typeof mukey !== 'string' || mukey.trim() === '' || typeof name !== 'string' || name.trim() === '') return undefined
  return {
    soilMapUnitKey: mukey,
    soilMapUnitName: name,
    ...(typeof farmlandClassification === 'string' && farmlandClassification.trim() !== ''
      ? { soilFarmlandClassification: farmlandClassification.trim() }
      : {}),
  }
}
