import { describe, expect, it } from 'vitest'
import type { ResearchProfileField } from '@/lib/jurisdiction-research'
import { provenanceLabel, researchDiscoveryMessage } from './JurisdictionResearchHub'

const baseField: ResearchProfileField = {
  value: 'example',
  verifiedAt: '2026-07-14T00:30:00.000Z',
  confidence: 0.9,
  volatility: 'annual',
}

describe('jurisdiction field provenance labels', () => {
  it('does not call legacy profile JSON verified', () => {
    expect(provenanceLabel(baseField)).toBe('Legacy — provenance unavailable')
  })

  it('distinguishes reviewed claims from verified claims', () => {
    expect(provenanceLabel({
      ...baseField,
      claimId: 'claim-reviewed',
      verificationState: 'REVIEWED',
    })).toContain('Reviewed:')
    expect(provenanceLabel({
      ...baseField,
      claimId: 'claim-verified',
      verificationState: 'VERIFIED',
    })).toContain('Verified:')
  })

  it('fails closed when unresolved evidence contradicts the current claim', () => {
    expect(provenanceLabel({
      ...baseField,
      claimId: 'claim-blocked',
      verificationState: 'BLOCKED',
    })).toBe('Blocked — contradictory evidence requires review')
  })

  it('labels preliminary discovery without implying verified coverage', () => {
    expect(researchDiscoveryMessage({ status: 'DISCOVERED', leads: 6, created: 6 })).toBe('6 preliminary county source leads queued for review. They are not yet verified.')
    expect(researchDiscoveryMessage({ status: 'DISCOVERY_NEEDED', leads: 0, created: 0 })).toContain('Preliminary discovery is needed')
  })
})
