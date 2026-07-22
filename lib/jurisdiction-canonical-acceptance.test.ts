import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(), queryRaw: vi.fn(), findFirst: vi.fn(), create: vi.fn(), auditCreate: vi.fn(),
}))

vi.mock('./db', () => ({ db: { $transaction: mocks.transaction } }))

import { publishCanonicalAcceptance } from './jurisdiction-canonical-acceptance'

const input = {
  jurisdictionId: 'jurisdiction-1', contractVersion: '2026-07-20.v1', caseReference: 'case-1',
  evidenceUrl: 'https://evidence.example/case-1', result: 'PASSED' as const, summary: 'Passed full acceptance.', reviewerId: 'reviewer-1',
  auditEvent: { tenantId: 'tenant-1', userId: 'user-1', action: 'JURISDICTION_CANONICAL_ACCEPTANCE_RECORDED', meta: { jurisdictionId: 'jurisdiction-1' } },
}

describe('canonical acceptance publication', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.queryRaw.mockResolvedValue([{ id: 'jurisdiction-1' }])
    mocks.findFirst.mockResolvedValue(null)
    mocks.create.mockResolvedValue({ id: 'acceptance-1', result: 'PASSED', reviewedAt: new Date('2026-07-22T00:00:00.000Z') })
    mocks.auditCreate.mockResolvedValue({})
    mocks.transaction.mockImplementation(async callback => callback({
      $queryRaw: mocks.queryRaw,
      jurisdictionCanonicalAcceptance: { findFirst: mocks.findFirst, create: mocks.create },
      auditEvent: { create: mocks.auditCreate },
    }))
  })

  it('creates an append-only first acceptance and its audit evidence together', async () => {
    await expect(publishCanonicalAcceptance(input)).resolves.toMatchObject({ acceptanceId: 'acceptance-1', result: 'PASSED' })
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ supersedesAcceptanceId: undefined }) }))
    expect(mocks.auditCreate).toHaveBeenCalledWith({ data: input.auditEvent })
  })

  it('requires the exact current acceptance for a replacement', async () => {
    mocks.findFirst.mockResolvedValue({ id: 'current-1' })
    await expect(publishCanonicalAcceptance(input)).rejects.toThrow('STALE_CANONICAL_ACCEPTANCE')
    await expect(publishCanonicalAcceptance({ ...input, replacesAcceptanceId: 'current-1', result: 'FAILED' })).resolves.toBeDefined()
    expect(mocks.create).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ supersedesAcceptanceId: 'current-1', result: 'FAILED' }) }))
  })
})
