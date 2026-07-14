import { describe, expect, it, vi } from 'vitest'
import { JURISDICTION_QUESTIONS } from './jurisdiction-question-library'
import {
  queueVerifiedCoverageNotifications,
  verifiedCoverageVersion,
} from './jurisdiction-coverage-notification'

const now = new Date('2026-07-14T00:00:00.000Z')
const fresh = {
  reviewDueAt: new Date('2026-08-01T00:00:00.000Z'),
  staleAt: new Date('2026-09-01T00:00:00.000Z'),
}
const claims = JURISDICTION_QUESTIONS.map((question, index) => ({
  id: `claim-${index}`,
  section: question.section,
  fieldKey: question.fieldKey,
  value: true,
  normalizedUnit: null,
  verificationState: 'VERIFIED',
  sourceAuthorityStatus: 'VERIFIED',
  freshness: fresh,
}))
const profile = JURISDICTION_QUESTIONS.reduce<Record<string, Record<string, unknown>>>((result, question, index) => {
  result[question.section] ??= {}
  result[question.section][question.fieldKey] = { value: true, claimId: `claim-${index}` }
  return result
}, {})

describe('verifiedCoverageVersion', () => {
  it('creates a stable version only for complete, current verified coverage', () => {
    const input = { workStatus: 'DISCOVERING' as const, sourceCount: 1, profile, activeClaims: claims, pendingCandidates: [], now }
    expect(verifiedCoverageVersion(input)).toMatch(/^verified:[a-f0-9]{64}$/)
    expect(verifiedCoverageVersion({ ...input, activeClaims: [...claims].reverse() })).toBe(verifiedCoverageVersion(input))
  })

  it.each([
    ['a pending candidate', { pendingCandidates: [{ section: claims[0].section, fieldKey: claims[0].fieldKey, extractedValue: { value: true } }] }],
    ['a stale current claim', { activeClaims: claims.map((claim, index) => index === 0 ? { ...claim, freshness: { ...fresh, staleAt: new Date('2026-07-01T00:00:00.000Z') } } : claim) }],
    ['an unverified authority', { activeClaims: claims.map((claim, index) => index === 0 ? { ...claim, sourceAuthorityStatus: 'UNVERIFIED' } : claim) }],
    ['paused work', { workStatus: 'PAUSED' as const }],
  ])('does not create a notification version for %s', (_reason, override) => {
    expect(verifiedCoverageVersion({
      workStatus: 'DISCOVERING', sourceCount: 1, profile, activeClaims: claims, pendingCandidates: [], now, ...override,
    })).toBeNull()
  })

  it('queues isolated tenant records for each requesting tenant', async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 2 })
    const tx = {
      jurisdictionProfile: { findUnique: vi.fn().mockResolvedValue(profile) },
      jurisdictionResearchWork: { findUnique: vi.fn().mockResolvedValue({ status: 'DISCOVERING' }) },
      jurisdictionSourceUrl: { count: vi.fn().mockResolvedValue(1) },
      jurisdictionClaim: { findMany: vi.fn().mockResolvedValue(claims) },
      extractionCandidate: { findMany: vi.fn().mockResolvedValue([]) },
      jurisdictionResearchDemand: { findMany: vi.fn().mockResolvedValue([
        { id: 'demand-a', tenantId: 'tenant-a', requestedBy: 'user-a' },
        { id: 'demand-b', tenantId: 'tenant-b', requestedBy: 'user-b' },
      ]) },
      user: { findMany: vi.fn().mockResolvedValue([
        { id: 'user-a', tenantId: 'tenant-a', email: 'a@example.test' },
        { id: 'user-b', tenantId: 'tenant-b', email: 'b@example.test' },
      ]) },
      jurisdictionCoverageNotification: { createMany },
    }

    await expect(queueVerifiedCoverageNotifications(tx as never, 'jurisdiction-1', now)).resolves.toBe(2)
    expect(createMany).toHaveBeenCalledWith(expect.objectContaining({
      skipDuplicates: true,
      data: expect.arrayContaining([
        expect.objectContaining({ demandId: 'demand-a', tenantId: 'tenant-a', recipientEmail: 'a@example.test' }),
        expect.objectContaining({ demandId: 'demand-b', tenantId: 'tenant-b', recipientEmail: 'b@example.test' }),
      ]),
    }))
  })
})
