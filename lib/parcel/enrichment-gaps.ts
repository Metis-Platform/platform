const SOURCE_LABELS: Record<string, string> = {
  fl_dor: 'Florida parcel baseline',
  regrid: 'parcel baseline',
  census_acs: 'Census demographic context',
  fema_nfhl: 'FEMA flood map',
  fws_nwi: 'National Wetlands Inventory map',
  usda_ssurgo: 'USDA soil map unit',
  usgs_3dep: 'USGS ground elevation',
  usgs_3dhp: 'USGS surface-water map',
  epa_echo: 'EPA CWA facility search',
  walk_score: 'neighborhood access score',
  hifld: 'electric utility coverage',
  postgis_zoning: 'zoning map',
}

export function parcelEnrichmentGapLabels(errors: Array<{ source: string }>): string[] {
  return [...new Set(errors.map(({ source }) => SOURCE_LABELS[source] ?? 'additional preliminary data source'))]
}
