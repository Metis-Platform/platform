import { describe, expect, it } from 'vitest'
import { assembleResearchProfile } from './research-profile'

describe('assembleResearchProfile manual fallback', () => {
  it('retains the supplied evidence URL on manually entered parcel facts', () => {
    const profile = assembleResearchProfile('2340282', '12127', 'FL', 'Volusia', [], {
      lotSizeSqFt: 5_000,
      zoning: 'R-4',
    }, 'https://vcpa.vcgov.org/parcel/summary/?altkey=2340282')

    expect(profile.sources.lotSizeSqFt).toMatchObject({
      provider: 'manual',
      sourceUrl: 'https://vcpa.vcgov.org/parcel/summary/?altkey=2340282',
    })
    expect(profile.sources.zoning).toMatchObject({ provider: 'manual' })
  })
})
