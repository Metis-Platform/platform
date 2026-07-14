import { describe, expect, it } from 'vitest'
import {
  canonicalClaimValue,
  claimValuesConflict,
  extractedClaimValue,
} from './jurisdiction-claim-contradiction'
import {
  blockContradictoryResearchFields,
  buildResearchProfile,
} from './jurisdiction-research'

describe('jurisdiction claim contradiction comparison', () => {
  it('canonicalizes nested object keys without changing array order', () => {
    const left = { value: { b: 2, a: { y: true, x: ['one', 'two'] } }, normalizedUnit: ' Days ' }
    const right = { value: { a: { x: ['one', 'two'], y: true }, b: 2 }, normalizedUnit: 'days' }
    expect(canonicalClaimValue(left)).toBe(canonicalClaimValue(right))
    expect(claimValuesConflict(left, right)).toBe(false)
    expect(claimValuesConflict(left, {
      value: { a: { x: ['two', 'one'], y: true }, b: 2 },
      normalizedUnit: 'days',
    })).toBe(true)
  })

  it('treats units and values as decision-bearing while normalizing unit casing', () => {
    expect(claimValuesConflict(
      { value: 30, normalizedUnit: 'days' },
      { value: 30, normalizedUnit: 'DAYS' },
    )).toBe(false)
    expect(claimValuesConflict(
      { value: 30, normalizedUnit: 'days' },
      { value: 30, normalizedUnit: 'months' },
    )).toBe(true)
    expect(claimValuesConflict({ value: 30 }, { value: 31 })).toBe(true)
  })

  it('extracts the publishable value and does not mistake metadata for the claim value', () => {
    expect(extractedClaimValue({ value: false, confidence: 0.9, normalizedUnit: ' Boolean ' }))
      .toEqual({ value: false, normalizedUnit: 'boolean' })
    expect(extractedClaimValue('direct')).toEqual({ value: 'direct', normalizedUnit: null })
  })

  it('blocks only the affected investor field without rewriting the stored profile', () => {
    const profile = buildResearchProfile({
      zoning: {
        minimumLotSizeSqft: {
          value: 7500,
          claimId: 'claim-1',
          verificationState: 'VERIFIED',
          verifiedAt: '2026-07-14T00:00:00.000Z',
          confidence: 1,
          volatility: 'static',
        },
      },
    })
    const blocked = blockContradictoryResearchFields(profile, [{
      section: 'zoning',
      fieldKey: 'minimumLotSizeSqft',
    }])
    expect(blocked.zoning.minimumLotSizeSqft.verificationState).toBe('BLOCKED')
    expect(profile.zoning.minimumLotSizeSqft.verificationState).toBe('VERIFIED')
  })
})
