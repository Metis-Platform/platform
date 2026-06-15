import { ingestCountyZoning, type ZoningSource } from '@/lib/parcel/zoning/ingest'
import { lookupZoning, type ZoningLookupResult } from '@/lib/parcel/zoning/lookup'

export class GeoService {
  lookupZoning(lat: number, lon: number, fipsCounty: string): Promise<ZoningLookupResult> {
    return lookupZoning(lat, lon, fipsCounty)
  }

  ingestCountyZoning(
    fipsCounty: string,
    source: ZoningSource,
  ): Promise<{ polygonCount: number; replaced: number }> {
    return ingestCountyZoning(fipsCounty, source)
  }
}

export function getGeoService(): GeoService {
  return new GeoService()
}
