import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  currentUser: vi.fn(),
  hasRole: vi.fn(),
  headers: vi.fn(),
  findDeal: vi.fn(),
  findTenantDeal: vi.fn(),
  updateMany: vi.fn(),
  deleteDeal: vi.fn(),
  updateLien: vi.fn(),
  updateDeed: vi.fn(),
  updateForeclosure: vi.fn(),
  createTransaction: vi.fn(),
  auditCreate: vi.fn(),
}))

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }))
vi.mock('next/headers', () => ({ headers: mocks.headers }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('@/lib/auth', () => ({ getCurrentUser: mocks.currentUser, hasRole: mocks.hasRole }))
vi.mock('@/lib/entitlements', () => ({ hasStrategy: vi.fn() }))
vi.mock('@/lib/rules-engine', () => ({ generateEventsForDeal: vi.fn() }))
vi.mock('@/lib/workflow-rules', () => ({ applyTenantWorkflowRules: vi.fn() }))
vi.mock('@/lib/audit', () => ({ emitAuditEvent: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    deal: { findUnique: mocks.findDeal },
    $transaction: async (callback: (tx: unknown) => unknown) => callback({
      deal: { findFirst: mocks.findTenantDeal, updateMany: mocks.updateMany, delete: mocks.deleteDeal },
      dealTaxLien: { update: mocks.updateLien },
      dealTaxDeed: { update: mocks.updateDeed },
      dealForeclosure: { update: mocks.updateForeclosure },
      financialTransaction: { create: mocks.createTransaction },
      auditEvent: { create: mocks.auditCreate },
    }),
  },
}))

import { deleteLien, markNotWon, recordRedemption, relistAsLead } from './lien'

describe('tax-lien lifecycle actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.currentUser.mockResolvedValue({ tenant: { id: 'tenant-1' }, user: { id: 'analyst-1', role: 'ANALYST' } })
    mocks.hasRole.mockReturnValue(true)
    mocks.headers.mockResolvedValue(new Headers({ 'x-request-id': '00000000-0000-4000-8000-000000000512' }))
    mocks.findDeal.mockResolvedValue({ id: 'deal-1', tenantId: 'tenant-1', status: 'LEAD', notes: 'Prior private note', taxLien: { dealId: 'deal-1' }, taxDeed: null, foreclosure: null })
    mocks.findTenantDeal.mockResolvedValue({ id: 'deal-1' })
    mocks.updateMany.mockResolvedValue({ count: 1 })
    mocks.createTransaction.mockResolvedValue({ id: 'transaction-1' })
  })

  it('atomically traces mark-not-won and relist transitions with opaque metadata', async () => {
    await markNotWon('deal-1', 'Private auction note')
    mocks.findDeal.mockResolvedValue({ id: 'deal-1', tenantId: 'tenant-1', status: 'NOT_WON', notes: null, taxLien: { dealId: 'deal-1' }, taxDeed: null, foreclosure: null })
    await relistAsLead('deal-1', '2026-09-01')

    expect(mocks.auditCreate).toHaveBeenNthCalledWith(1, {
      data: { tenantId: 'tenant-1', userId: 'analyst-1', requestId: '00000000-0000-4000-8000-000000000512', action: 'DEAL_MARKED_NOT_WON', meta: { dealId: 'deal-1' } },
    })
    expect(mocks.auditCreate).toHaveBeenNthCalledWith(2, {
      data: { tenantId: 'tenant-1', userId: 'analyst-1', requestId: '00000000-0000-4000-8000-000000000512', action: 'DEAL_RELISTED_AS_LEAD', meta: { dealId: 'deal-1' } },
    })
    expect(JSON.stringify(mocks.auditCreate.mock.calls[0][0])).not.toContain('Private auction note')
  })

  it('atomically traces redemption without recording amount or date', async () => {
    await recordRedemption('deal-1', 125000, new Date('2026-08-15T12:00:00.000Z'))

    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-1', userId: 'analyst-1', requestId: '00000000-0000-4000-8000-000000000512',
        action: 'LIEN_REDEMPTION_RECORDED', meta: { dealId: 'deal-1', transactionId: 'transaction-1' },
      },
    })
    const audit = JSON.stringify(mocks.auditCreate.mock.calls[0][0])
    expect(audit).not.toContain('125000')
    expect(audit).not.toContain('2026-08-15')
  })

  it('atomically traces tenant-owned deal deletion', async () => {
    await deleteLien('deal-1')

    expect(mocks.deleteDeal).toHaveBeenCalledWith({ where: { id: 'deal-1' } })
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: { tenantId: 'tenant-1', userId: 'analyst-1', requestId: '00000000-0000-4000-8000-000000000512', action: 'DEAL_DELETED', meta: { dealId: 'deal-1' } },
    })
  })

  it('does not mutate or audit a foreign lifecycle target', async () => {
    mocks.findDeal.mockResolvedValue(null)
    mocks.findTenantDeal.mockResolvedValue(null)

    expect(await markNotWon('foreign-deal', null)).toEqual({ error: 'Deal not found.' })
    expect(await recordRedemption('foreign-deal', 10, null)).toEqual({ error: 'Deal not found.' })
    expect(await deleteLien('foreign-deal')).toEqual({ error: 'Deal not found.' })
    expect(mocks.updateMany).not.toHaveBeenCalled()
    expect(mocks.deleteDeal).not.toHaveBeenCalled()
    expect(mocks.auditCreate).not.toHaveBeenCalled()
  })
})
