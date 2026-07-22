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
    )).toEqual(['FEMA flood map', 'Florida parcel baseline', 'HIFLD retail service territory map'])
  })

  it('names an incomplete official Volusia parcel response', () => {
    expect(parcelEnrichmentGapLabels([], [{ source: 'volusia_property_appraiser' }]))
      .toEqual(['Volusia Property Appraiser parcel facts'])
  })

  it('names an incomplete official Harris parcel response', () => {
    expect(parcelEnrichmentGapLabels([], [{ source: 'harris_property_appraiser' }]))
      .toEqual(['Harris Central Appraisal District parcel facts'])
  })
})
