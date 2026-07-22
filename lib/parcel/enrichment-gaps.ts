const SOURCE_LABELS: Record<string, string> = {
  fl_dor: 'Florida parcel baseline',
  volusia_property_appraiser: 'Volusia Property Appraiser parcel facts',
  palm_beach_property_appraiser: 'Palm Beach County Property Appraiser parcel facts',
  harris_property_appraiser: 'Harris Central Appraisal District parcel facts',
  regrid: 'parcel baseline',
  census_acs: 'Census demographic context',
  fema_nfhl: 'FEMA flood map',
  fws_nwi: 'National Wetlands Inventory map',
  usda_ssurgo: 'USDA soil map unit',
  usgs_3dep: 'USGS ground elevation',
  usgs_3dhp: 'USGS surface-water map',
  usgs_padus: 'USGS protected-area map',
  epa_echo: 'EPA CWA facility search',
  walk_score: 'neighborhood access score',
  hifld: 'HIFLD retail service territory map',
  postgis_zoning: 'zoning map',
}

export function parcelEnrichmentGapLabels(...sourceGroups: Array<Array<{ source: string }>>): string[] {
  return [...new Set(sourceGroups
    .flat()
    .map(({ source }) => SOURCE_LABELS[source] ?? 'additional preliminary data source'))]
}
