export async function fetchElectricUtility(
  lat: number,
  lon: number,
): Promise<{
  utilityName?: string
  serviceAreaType?: 'urban' | 'rural'
  electricAvailable?: boolean
}> {
  void lat
  void lon
  // HIFLD publishes utility territory GIS layers, but point-in-polygon belongs in #233 GeoService.
  return {}
}
