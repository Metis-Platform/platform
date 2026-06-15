import { db } from '@/lib/db'
import { fetchJson } from '@/lib/parcel/sources/types'
import { isFeatureCollection, isPolygonGeometry, type GeoJsonFeatureCollection } from '@/lib/geo/types'

export interface ZoningSource {
  type: 'arcgis_featureserver' | 'geojson_url' | 'shapefile_path'
  url: string
  fipsField: string
  nameField?: string
}

interface ZoningPolygonInput {
  zoneCode: string
  zoneName: string | null
  geometryJson: string
}

export async function ingestCountyZoning(
  fipsCounty: string,
  source: ZoningSource,
): Promise<{ polygonCount: number; replaced: number }> {
  const collection = await fetchZoningCollection(source)
  const polygons = parseZoningFeatures(collection, source)

  const replaced = await db.$transaction(async (tx) => {
    const deleted = await tx.$executeRaw`
      DELETE FROM zoning_polygons
      WHERE fips_county = ${fipsCounty}
    `

    for (const polygon of polygons) {
      await tx.$executeRaw`
        INSERT INTO zoning_polygons (fips_county, zone_code, zone_name, geom)
        VALUES (
          ${fipsCounty},
          ${polygon.zoneCode},
          ${polygon.zoneName},
          ST_SetSRID(ST_Multi(ST_GeomFromGeoJSON(${polygon.geometryJson})), 4326)
        )
      `
    }

    return deleted
  })

  return { polygonCount: polygons.length, replaced }
}

export async function fetchZoningCollection(source: ZoningSource): Promise<GeoJsonFeatureCollection> {
  if (source.type === 'shapefile_path') {
    throw new Error('Shapefile ingestion requires an ogr2ogr conversion step and is not supported in-process.')
  }

  const json = source.type === 'arcgis_featureserver'
    ? await fetchArcGisFeatureServer(source.url)
    : await fetchJson(source.url)

  if (!isFeatureCollection(json)) {
    throw new Error('Zoning source did not return a GeoJSON FeatureCollection.')
  }

  return json
}

export function parseZoningFeatures(
  collection: GeoJsonFeatureCollection,
  source: Pick<ZoningSource, 'fipsField' | 'nameField'>,
): ZoningPolygonInput[] {
  return collection.features.flatMap((feature) => {
    const geometry = feature.geometry
    if (!isPolygonGeometry(geometry)) return []

    const properties = feature.properties ?? {}
    const zoneCodeValue = properties[source.fipsField]
    if (typeof zoneCodeValue !== 'string' && typeof zoneCodeValue !== 'number') return []

    const zoneNameValue = source.nameField ? properties[source.nameField] : null

    return [{
      zoneCode: String(zoneCodeValue).trim(),
      zoneName: typeof zoneNameValue === 'string' ? zoneNameValue.trim() : null,
      geometryJson: JSON.stringify(geometry),
    }]
  }).filter(polygon => polygon.zoneCode.length > 0)
}

async function fetchArcGisFeatureServer(url: string): Promise<unknown> {
  const queryUrl = url.endsWith('/query') ? url : `${url.replace(/\/$/, '')}/query`
  const params = new URLSearchParams({
    f: 'geojson',
    where: '1=1',
    outFields: '*',
    returnGeometry: 'true',
    outSR: '4326',
    resultRecordCount: '2000',
  })

  return fetchJson(`${queryUrl}?${params.toString()}`)
}
