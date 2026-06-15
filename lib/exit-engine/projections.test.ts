import { describe, expect, it } from 'vitest'
import { projectCapRate, projectLienReturn, projectMonthlyRent, projectNetProfit } from './projections'

describe('exit-engine projections', () => {
  it('projects net profit as a low/mid/high range', () => {
    const result = projectNetProfit({
      arv: { low: 180000, mid: 200000, high: 220000 },
      purchasePrice: 120000,
      rehabCost: { low: 25000, mid: 30000, high: 35000 },
      holdingCostPerMonth: 1000,
      holdMonths: 4,
    })

    expect(result.metric).toBe('net_profit')
    expect(result.currency).toBe('USD')
    expect(result.low).toBe(10200)
    expect(result.mid).toBe(34000)
    expect(result.high).toBe(57800)
  })

  it('projects monthly rent from comparable rent and property class', () => {
    const result = projectMonthlyRent({
      comparableRent: 1500,
      bedroomCount: 3,
      propertyClass: 'A',
    })

    expect(result.metric).toBe('monthly_cashflow')
    expect(result.low).toBeCloseTo(1485)
    expect(result.mid).toBeCloseTo(1650)
    expect(result.high).toBeCloseTo(1815)
  })

  it('projects cap rate from NOI range and purchase price', () => {
    const result = projectCapRate({
      noi: {
        low: 9000,
        mid: 10000,
        high: 11000,
        basis: 'NOI estimate',
        assumptions: ['rent roll estimate'],
        currency: 'USD',
        metric: 'net_profit',
      },
      purchasePrice: 200000,
    })

    expect(result.metric).toBe('roi')
    expect(result.low).toBe(0.045)
    expect(result.mid).toBe(0.05)
    expect(result.high).toBe(0.055)
  })

  it('projects lien return as an ROI range', () => {
    const result = projectLienReturn({
      faceValue: 10000,
      interestRate: 0.18,
      holdMonths: 6,
      redemptionProbability: 0.8,
    })

    expect(result.metric).toBe('roi')
    expect(result.low).toBeCloseTo(0.0576)
    expect(result.mid).toBeCloseTo(0.072)
    expect(result.high).toBeCloseTo(0.0864)
  })
})
