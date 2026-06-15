import type { ParcelProfile } from '@/lib/exit-engine/types'
import { fetchJson, numberFromUnknown, objectRecord } from './types'

export async function fetchRegridParcel(apnNormalized: string, fipsCounty: string): Promise<Partial<ParcelProfile>> {
  const apiKey = process.env.REGRID_API_KEY
  if (!apiKey) return {}

  const params = new URLSearchParams({
    token: apiKey,
    query: apnNormalized,
    fips: fipsCounty,
  })
  const json = await fetchJson(`https://app.regrid.com/api/v2/parcels/query?${params.toString()}`)
  const record = objectRecord(json)
  const features = Array.isArray(record.features) ? record.features : []
  const first = objectRecord(features[0])
  const properties = objectRecord(first.properties)

  return normalizeRegridProperties(properties)
}

export function normalizeRegridProperties(properties: Record<string, unknown>): Partial<ParcelProfile> {
  const lotSizeAcres = numberFromUnknown(properties.ll_gisacre ?? properties.acres)
  const lotSizeSqFt = numberFromUnknown(properties.ll_gissqft ?? properties.sqft)
    ?? (lotSizeAcres == null ? undefined : lotSizeAcres * 43560)
  const structureSqFt = numberFromUnknown(properties.bldg_area ?? properties.structureSqFt)

  return {
    apnRaw: typeof properties.parcelnumb === 'string' ? properties.parcelnumb : undefined,
    lotSizeSqFt,
    lotSizeAcres,
    assessedValue: numberFromUnknown(properties.parval ?? properties.assessedValue),
    assessedYear: numberFromUnknown(properties.taxyear ?? properties.assessedYear),
    landUseCode: typeof properties.usedesc === 'string' ? properties.usedesc : undefined,
    improved: structureSqFt == null ? undefined : structureSqFt > 0,
    structureSqFt,
    marketValueEstimate: numberFromUnknown(properties.parval ?? properties.marketValueEstimate),
  }
}
