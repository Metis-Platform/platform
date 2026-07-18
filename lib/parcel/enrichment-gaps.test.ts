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
})
