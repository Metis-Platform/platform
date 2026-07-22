import { describe, expect, it } from 'vitest'
import { computeMao } from './calculator'
import type { ParcelProfile } from '@/lib/exit-engine/types'

const baseParcel: ParcelProfile = {
  apn: '2340282',
  apnRaw: '2340282',
  fipsCounty: '12127',
  improved: false,
  dataCompleteness: 1,
  lastUpdated: new Date('2026-07-14T00:00:00Z'),
  sources: {},
  marketValueEstimate: 100_000,
}

describe('computeMao raw land bands', () => {
  it('uses the documented 25-50% rural land band', () => {
    const result = computeMao({ ...baseParcel, landMarketType: 'RURAL' }, []).find(m => m.strategy === 'LAND')

    expect(result).toMatchObject({
      label: 'Raw Land (Rural land)',
      scenario: { conservative: 25_000, moderate: 37_500, aggressive: 50_000 },
      basis: 'Market value estimate $100K × 25-50%',
    })
  })

  it('uses the documented 40-70% infill lot band', () => {
    const result = computeMao({ ...baseParcel, landMarketType: 'INFILL' }, []).find(m => m.strategy === 'LAND')

    expect(result).toMatchObject({
      label: 'Raw Land (Infill lot)',
      scenario: { conservative: 40_000, moderate: 55_000, aggressive: 70_000 },
      basis: 'Market value estimate $100K × 40-70%',
    })
  })

  it('does not calculate a bid ceiling without a rural or infill classification', () => {
    const result = computeMao(baseParcel, []).find(m => m.strategy === 'LAND')

    expect(result).toMatchObject({
      label: 'Raw Land — classification needed',
      scenario: { conservative: null, moderate: null, aggressive: null },
      warningType: 'land_classification',
    })
  })

  it('labels a county assessment as a proxy when no market estimate exists', () => {
    const result = computeMao({
      ...baseParcel,
      marketValueEstimate: undefined,
      assessedValue: 100_000,
      landMarketType: 'RURAL',
    }, []).find(m => m.strategy === 'LAND')

    expect(result?.basis).toBe('Assessed value proxy $100K × 25-50%')
  })

  it('does not call a parcel unbuildable when build-and-sell is blocked only by investor capital', () => {
    const result = computeMao({ ...baseParcel, landMarketType: 'INFILL' }, [{
      exitKey: 'VACANT_BUILD_AND_SELL', verdict: 'NOT_VIABLE', confidence: 1,
      blockers: ['Investor improvement capital is below estimated construction cost'],
      conditions: [], dataGaps: [],
    }]).find(m => m.strategy === 'LAND')

    expect(result?.warningType).toBeUndefined()
  })
})
