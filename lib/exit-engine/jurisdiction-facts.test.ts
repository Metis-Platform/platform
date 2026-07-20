import { StrategyType, type JurisdictionStrategyData, type Prisma } from '@/app/generated/prisma'
import { describe, expect, it } from 'vitest'
import { buildJurisdictionFacts } from './jurisdiction-facts'

function strategyData(data: Prisma.JsonValue): JurisdictionStrategyData {
  return {
    id: 'jsd_1',
    jurisdictionId: 'jur_1',
    strategy: StrategyType.LAND,
    data,
    updatedAt: new Date('2026-06-15T00:00:00.000Z'),
    updatedBy: null,
  }
}

describe('buildJurisdictionFacts', () => {
  it('reads explicit strategy JSON fields and FMR values', () => {
    const facts = buildJurisdictionFacts(strategyData({
      taxLienInterestRate: 0.18,
      taxDeedRedemptionDays: 365,
      strAllowed: true,
      rentControlZone: false,
      wholesaleLicenseRequired: true,
      minLotSizeByZone: { default: 5000, 'R-1': 7500 },
      setbacksByZone: { 'R-1': { front: 20, side: 7.5, rear: 15 } },
      allowedUsesByZone: { 'R-1': ['single_family'] },
    }), { 2: 1650 })

    expect(facts.taxLienInterestRate).toBe(0.18)
    expect(facts.taxDeedRedemptionDays).toBe(365)
    expect(facts.strAllowed).toBe(true)
    expect(facts.rentControlZone).toBe(false)
    expect(facts.wholesaleLicenseRequired).toBe(true)
    expect(facts.minLotSizeSqFt('R-1')).toBe(7500)
    expect(facts.minLotSizeSqFt('R-2')).toBe(5000)
    expect(facts.setbackFeet('R-1')).toEqual({ front: 20, side: 7.5, rear: 15 })
    expect(facts.allowedUses?.('R-1')).toEqual(['single_family'])
    expect(facts.fmr(2)).toBe(1650)
  })

  it('prefers decoded zoning_codes for zoning-specific dimensional standards', () => {
    const facts = buildJurisdictionFacts(strategyData({
      minLotSizeByZone: { 'R-1': 7500 },
      zoning_codes: {
        'R-1': {
          minLotSizeSqFt: 6000,
          minLotWidthFt: 60,
          setbacks: { front: 25 },
          allowedUses: ['duplex'],
        },
      },
    }), {})

    expect(facts.minLotSizeSqFt('R-1')).toBe(6000)
    expect(facts.minLotWidthFt?.('R-1')).toBe(60)
    expect(facts.setbackFeet('R-1')).toEqual({ front: 25 })
    expect(facts.allowedUses?.('R-1')).toEqual(['duplex'])
  })

  it('returns undefined accessors for missing strategy data', () => {
    const facts = buildJurisdictionFacts(null, {})

    expect(facts.minLotSizeSqFt('R-1')).toBeUndefined()
    expect(facts.minLotWidthFt?.('R-1')).toBeUndefined()
    expect(facts.setbackFeet('R-1')).toBeUndefined()
    expect(facts.fmr(3)).toBeUndefined()
  })

  it('withholds county land-use fields without withholding county tax-sale facts', () => {
    const facts = buildJurisdictionFacts(strategyData({
      zoning_codes: { R1: { minLotSizeSqFt: 5_000, minLotWidthFt: 50, setbacks: { front: 20 } } },
      strAllowed: true,
      rentControlZone: true,
      wholesaleLicenseRequired: true,
      subdivisionAllowed: true,
      taxDeedRedemptionDays: 90,
    }), {}, { allowCountyLandUseRules: false })

    expect(facts.minLotSizeSqFt('R1')).toBeUndefined()
    expect(facts.minLotWidthFt?.('R1')).toBeUndefined()
    expect(facts.setbackFeet('R1')).toBeUndefined()
    expect(facts.strAllowed).toBeUndefined()
    expect(facts.subdivisionAllowed).toBeUndefined()
    expect(facts.taxDeedRedemptionDays).toBe(90)
  })
})
