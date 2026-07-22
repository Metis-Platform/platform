import { describe, expect, it } from 'vitest'
import { buildInvestmentDecision } from './decision'

const parcel = {
  apn: '00414218000001860', apnRaw: '00414218000001860', fipsCounty: '12099',
  lotSizeSqFt: 50_094, frontageLinearFt: 209, lotDepthFt: 239, improved: false,
  zoning: 'AR', zoningDescription: 'AGRICULTURAL RESIDENTIAL', floodZone: 'X',
  dataCompleteness: 1, lastUpdated: new Date(), sources: {},
}

const gates = [{
  key: 'ZONING_BUILD' as const, label: 'Zoning and buildability', status: 'REVIEW_REQUIRED' as const,
  evidence: 'Zoning shown as AR.', nextStep: 'Verify the governing planning/zoning authority.',
}]

describe('investment decision packet', () => {
  it('keeps the Palm Beach acceptance parcel at verify while naming its most plausible exit', () => {
    expect(buildInvestmentDecision(parcel, [{
      exitKey: 'VACANT_SELL_TO_BUILDER', verdict: 'CONDITIONAL', confidence: 0.75,
      blockers: [], conditions: ['Governing local land-use authority is unresolved'], dataGaps: [],
    }], gates, [])).toMatchObject({
      status: 'VERIFY_BEFORE_ACTION',
      recommendedExit: 'VACANT_SELL_TO_BUILDER',
      recommendedExitLabel: 'Sell to builder',
      nextAction: 'Verify the governing planning/zoning authority.',
    })
  })

  it('does not offer a bid range when raw-land pricing lacks its required classification', () => {
    const decision = buildInvestmentDecision(parcel, [{
      exitKey: 'VACANT_SELL_AS_IS', verdict: 'CONDITIONAL', confidence: 0.75,
      blockers: [], conditions: [], dataGaps: [],
    }], gates, [{
      strategy: 'LAND', label: 'Raw Land — classification needed',
      scenario: { conservative: null, moderate: null, aggressive: null }, basis: 'Classification missing',
    }])

    expect(decision.bidGuidance).toBeUndefined()
  })

  it('passes only when a documented physical blocker leaves no supported exit', () => {
    expect(buildInvestmentDecision(parcel, [{
      exitKey: 'VACANT_SELL_TO_BUILDER', verdict: 'NOT_VIABLE', confidence: 1,
      blockers: ['Landlocked parcel lacks legal/physical road frontage'], conditions: [], dataGaps: [],
    }], [], [])).toMatchObject({ status: 'PASS' })
  })
})
