import { describe, expect, it } from 'vitest'
import { evaluateExits } from './engine'
import { EXIT_REGISTRY } from './registry'
import type { EvalContext, ParcelProfile } from './types'

const baseParcel: ParcelProfile = {
  apn: '1234567890',
  apnRaw: '123-456-7890',
  fipsCounty: '12127',
  lotSizeSqFt: 20000,
  lotSizeAcres: 0.45,
  improved: false,
  zoning: 'R-1',
  floodZone: 'X',
  roadFrontage: 'paved',
  assessedValue: 80000,
  purchasePrice: 50000,
  lienFaceValue: 5000,
  dataCompleteness: 1,
  lastUpdated: new Date(),
  sources: {},
}

function ctx(parcel: Partial<ParcelProfile> = {}): EvalContext {
  return {
    parcel: { ...baseParcel, ...parcel },
    jurisdiction: {
      minLotSizeSqFt: () => 7500,
      minLotWidthFt: () => 75,
      setbackFeet: () => ({ front: 25, side: 7.5, rear: 20 }),
      strAllowed: true,
      rentControlZone: false,
      wholesaleLicenseRequired: false,
      taxDeedRedemptionDays: 365,
      taxLienInterestRate: 0.18,
      fmr: () => 1600,
    },
    investor: {
      financing: 'CASH',
      improvementCapital: 300000,
      holdMonthsTolerance: 12,
      licenseTypes: ['RE_LICENSE'],
    },
    strategy: 'LAND',
  }
}

describe('exit evaluators registry', () => {
  it('registers all 30 exit evaluators', () => {
    expect(EXIT_REGISTRY).toHaveLength(30)
  })

  it('returns viable vacant exits on a complete vacant parcel', () => {
    const results = evaluateExits(ctx())
    expect(results.find(result => result.exitKey === 'VACANT_SELL_TO_BUILDER')?.verdict).toBe('VIABLE')
  })

  it('applies universal bankruptcy blocker', () => {
    const results = evaluateExits(ctx({ bankruptcyStay: true }))
    expect(results.every(result => result.verdict === 'NOT_VIABLE')).toBe(true)
    expect(results[0].blockers[0]).toContain('Bankruptcy automatic stay')
  })

  it('returns insufficient data from evaluator when hard data is missing', () => {
    const evaluator = EXIT_REGISTRY.find(entry => entry.exitKey === 'VACANT_SELL_TO_BUILDER')!
    expect(evaluator.evaluate(ctx({ lotSizeSqFt: undefined })).verdict).toBe('INSUFFICIENT_DATA')
  })

  it('keeps Volusia-like standard dimensional failures conditional when nonconforming eligibility is unresolved', () => {
    const result = EXIT_REGISTRY.find(entry => entry.exitKey === 'VACANT_SELL_TO_BUILDER')!.evaluate(ctx({
      lotSizeSqFt: 5000,
      frontageLinearFt: 50,
      lotDepthFt: 100,
      zoning: 'R-4',
    }))
    expect(result.verdict).toBe('CONDITIONAL')
    expect(result.blockers).toContain('Lot is smaller than jurisdiction minimum lot size')
    expect(result.blockers).toContain('Lot frontage is smaller than jurisdiction minimum width')
    expect(result.conditions.join(' ')).toContain('nonconforming-lot eligibility')
  })
})
