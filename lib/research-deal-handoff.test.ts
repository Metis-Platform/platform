import { describe, expect, it } from 'vitest'
import { prefilledResearchApn, prefilledResearchSnapshotId, researchDealHref } from './research-deal-handoff'

describe('research deal handoff', () => {
  it('carries the researched APN and jurisdiction in a safe new-deal URL', () => {
    expect(researchDealHref('jurisdiction-1', '2340282', 'c123456789012345678901234')).toBe('/dashboard/deals/new?jid=jurisdiction-1&apn=2340282&research=c123456789012345678901234')
  })

  it('accepts a bounded APN and ignores empty or oversized query values', () => {
    expect(prefilledResearchApn(' 2340282 ')).toBe('2340282')
    expect(prefilledResearchApn('')).toBeUndefined()
    expect(prefilledResearchApn('x'.repeat(61))).toBeUndefined()
  })

  it('accepts only a bounded opaque snapshot identifier', () => {
    expect(prefilledResearchSnapshotId('c123456789012345678901234')).toBe('c123456789012345678901234')
    expect(prefilledResearchSnapshotId('not-a-snapshot')).toBeUndefined()
  })
})
