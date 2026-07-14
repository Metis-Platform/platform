import { describe, expect, it } from 'vitest'
import { prefilledResearchApn, researchDealHref } from './research-deal-handoff'

describe('research deal handoff', () => {
  it('carries the researched APN and jurisdiction in a safe new-deal URL', () => {
    expect(researchDealHref('jurisdiction-1', '2340282')).toBe('/dashboard/deals/new?jid=jurisdiction-1&apn=2340282')
  })

  it('accepts a bounded APN and ignores empty or oversized query values', () => {
    expect(prefilledResearchApn(' 2340282 ')).toBe('2340282')
    expect(prefilledResearchApn('')).toBeUndefined()
    expect(prefilledResearchApn('x'.repeat(61))).toBeUndefined()
  })
})
