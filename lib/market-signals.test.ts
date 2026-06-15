import { describe, expect, it } from 'vitest'
import { computeOpportunityScore, computeSaturationScore } from './market-signals'

describe('market signal scoring', () => {
  it('computes opportunity from normalized distress, demand, employment, and yield inputs', () => {
    expect(computeOpportunityScore({
      foreclosureFilingRatePer1K: 5,
      taxDelinquencyRatePct: 10,
      populationGrowthRatePct: 5,
      unemploymentRatePct: 5,
      avgCapRatePct: 6,
    })).toBe(54)
  })

  it('reweights opportunity when paid ATTOM fields are absent', () => {
    expect(computeOpportunityScore({
      populationGrowthRatePct: 4,
      unemploymentRatePct: 4,
    })).toBe(57)
  })

  it('computes saturation from investor and flipper share inputs', () => {
    expect(computeSaturationScore({
      institutionalInvestorSharePct: 20,
      fixFlipRatePct: 7.5,
      investorPurchaseSharePct: 20,
    })).toBe(50)
  })

  it('returns undefined when no saturation inputs exist', () => {
    expect(computeSaturationScore({})).toBeUndefined()
  })
})
