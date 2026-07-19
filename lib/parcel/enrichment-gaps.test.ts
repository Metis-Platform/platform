import { describe, expect, it } from 'vitest'
import { parcelEnrichmentGapLabels } from './enrichment-gaps'

describe('parcel enrichment data gaps', () => {
  it('turns failed national baseline identifiers into concise investor-readable checks', () => {
    expect(parcelEnrichmentGapLabels([
      { source: 'fema_nfhl' }, { source: 'usgs_3dep' }, { source: 'fema_nfhl' },
    ])).toEqual(['FEMA flood map', 'USGS ground elevation'])
  })

  it('keeps unknown providers non-technical and does not expose provider errors', () => {
    expect(parcelEnrichmentGapLabels([{ source: 'unrecognized_provider' }]))
      .toEqual(['additional preliminary data source'])
  })

  it('combines failed and silent source gaps without duplicate labels', () => {
    expect(parcelEnrichmentGapLabels(
      [{ source: 'fema_nfhl' }],
      [{ source: 'fl_dor' }, { source: 'fema_nfhl' }, { source: 'hifld' }],
    )).toEqual(['FEMA flood map', 'Florida parcel baseline', 'electric utility coverage'])
  })

  it('names an incomplete official Volusia parcel response', () => {
    expect(parcelEnrichmentGapLabels([], [{ source: 'volusia_property_appraiser' }]))
      .toEqual(['Volusia Property Appraiser parcel facts'])
  })
})
