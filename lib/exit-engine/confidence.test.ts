import { afterEach, describe, expect, it } from 'vitest'
import { scoreConfidence } from './confidence'
import { evaluateExits } from './engine'
import { EXIT_REGISTRY } from './registry'
import type { EvalContext, ParcelProfile } from './types'

function source(observedAt: Date, provider: 'fl_dor' | 'manual' = 'fl_dor') {
  return { provider, retrievedAt: observedAt, ttlHours: 24 * 180, observedAt, ttlDays: 180 }
}

function parcel(overrides: Partial<ParcelProfile>): ParcelProfile {
  return {
    apn: '1234567890',
    apnRaw: '123-456-7890',
    fipsCounty: '12127',
    dataCompleteness: 1,
    lastUpdated: freshDate,
    sources: {},
    ...overrides,
  }
}

const freshDate = new Date()

describe('scoreConfidence', () => {
  it('returns score 0 and hard gaps when a hard field is missing', () => {
    const result = scoreConfidence({
      parcel: parcel({ lotSizeSqFt: 5000 }),
      hardFields: ['lotSizeSqFt', 'zoning'],
      softFields: ['assessedValue'],
    })

    expect(result.score).toBe(0)
    expect(result.gaps).toEqual([
      {
        field: 'zoning',
        severity: 'HARD',
        message: 'zoning is required to evaluate this exit.',
      },
    ])
  })

  it('scores completeness, recency, and source reliability', () => {
    const profile = parcel({
      lotSizeSqFt: 5000,
      zoning: 'R-1',
      assessedValue: 80000,
      sources: {
        lotSizeSqFt: source(freshDate),
        zoning: source(freshDate),
        assessedValue: source(freshDate, 'manual'),
      },
    })

    const result = scoreConfidence({
      parcel: profile,
      hardFields: ['lotSizeSqFt', 'zoning'],
      softFields: ['assessedValue'],
    })

    expect(result.score).toBeCloseTo(0.93)
    expect(result.gaps).toEqual([])
  })
})

describe('evaluateExits confidence wrapper', () => {
  afterEach(() => {
    EXIT_REGISTRY.length = 0
  })

  it('downgrades VIABLE to CONDITIONAL when confidence is below 0.75', () => {
    EXIT_REGISTRY.push({
      exitKey: 'IMPROVED_FLIP',
      evaluate: () => ({
        exitKey: 'IMPROVED_FLIP',
        verdict: 'VIABLE',
        blockers: [],
        conditions: [],
      }),
    })

    const ctx: EvalContext = {
      parcel: parcel({
        improved: true,
        structureSqFt: 1200,
        arv: { low: 150000, mid: 160000, high: 170000 },
      }),
      jurisdiction: {
        minLotSizeSqFt: () => undefined,
        setbackFeet: () => undefined,
        fmr: () => undefined,
      },
      investor: { financing: 'CASH' },
      strategy: 'FIX_FLIP',
    }

    const [result] = evaluateExits(ctx)

    expect(result.verdict).toBe('CONDITIONAL')
    expect(result.confidence).toBeLessThan(0.75)
    expect(result.dataGaps.map(gap => gap.field)).toEqual(['rehabCost', 'assessedValue'])
  })
})
