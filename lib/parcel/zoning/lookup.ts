import { db } from '@/lib/db'
import { fetchJson, objectRecord } from '@/lib/parcel/sources/types'

export interface ZoningLookupResult {
  zoneCode: string | null
  zoneName: string | null
  source: 'postgis' | 'zoneomics' | 'manual'
}

export async function lookupZoning(
  lat: number,
  lon: number,
  fipsCounty: string,
): Promise<ZoningLookupResult> {
  const [row] = await db.$queryRaw<Array<{ zone_code: string; zone_name: string | null }>>`
    SELECT zone_code, zone_name
    FROM zoning_polygons
    WHERE fips_county = ${fipsCounty}
      AND ST_Within(ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326), geom)
    LIMIT 1
  `

  if (row) {
    return { zoneCode: row.zone_code, zoneName: row.zone_name, source: 'postgis' }
  }

  return lookupZoneomics(lat, lon)
}

async function lookupZoneomics(lat: number, lon: number): Promise<ZoningLookupResult> {
  const apiKey = process.env.ZONEOMICS_API_KEY
  if (!apiKey) return { zoneCode: null, zoneName: null, source: 'manual' }

  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lon),
    api_key: apiKey,
  })
  const json = objectRecord(await fetchJson(`https://api.zoneomics.com/v2/zoneDetail?${params.toString()}`))
  const zoneCode = firstString(json.zoneCode, json.zone_code, json.zoning, json.code)
  const zoneName = firstString(json.zoneName, json.zone_name, json.name, json.description)

  return {
    zoneCode,
    zoneName,
    source: zoneCode ? 'zoneomics' : 'manual',
  }
}

function firstString(...values: unknown[]): string | null {
  const value = values.find(candidate => typeof candidate === 'string' && candidate.trim().length > 0)
  return typeof value === 'string' ? value.trim() : null
}
