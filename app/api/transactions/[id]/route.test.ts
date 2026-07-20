import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({ getCurrentUser: vi.fn(), findFirst: vi.fn(), delete: vi.fn(), auditCreate: vi.fn() }))

vi.mock('@/lib/auth', () => ({ getCurrentUser: mocks.getCurrentUser, hasRole: (role: string) => role === 'ANALYST' }))
vi.mock('@/lib/db', () => ({
  db: {
    $transaction: async (callback: (tx: unknown) => unknown) => callback({
      financialTransaction: { findFirst: mocks.findFirst, delete: mocks.delete }, auditEvent: { create: mocks.auditCreate },
    }),
  },
}))

import { DELETE } from './route'

describe('transaction deletion route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCurrentUser.mockResolvedValue({ tenant: { id: 'tenant-1' }, user: { id: 'analyst-1', role: 'ANALYST' } })
    mocks.findFirst.mockResolvedValue({ id: 'transaction-1', dealId: 'deal-1' })
  })

  it('atomically records a correlated transaction deletion without financial data', async () => {
    const response = await DELETE(new Request('https://metis.example/api/transactions/transaction-1', {
      method: 'DELETE', headers: { 'x-request-id': '00000000-0000-4000-8000-000000000072' },
    }) as NextRequest, { params: Promise.resolve({ id: 'transaction-1' }) })
    expect(response.status).toBe(204)
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-1', userId: 'analyst-1', requestId: '00000000-0000-4000-8000-000000000072',
        action: 'FINANCIAL_TRANSACTION_DELETED', meta: { transactionId: 'transaction-1', dealId: 'deal-1' },
      },
    })
  })

  it('does not delete or audit a transaction outside the tenant', async () => {
    mocks.findFirst.mockResolvedValue(null)
    const response = await DELETE(new Request('https://metis.example/api/transactions/foreign', { method: 'DELETE' }) as NextRequest, { params: Promise.resolve({ id: 'foreign' }) })
    expect(response.status).toBe(404)
    expect(mocks.delete).not.toHaveBeenCalled()
    expect(mocks.auditCreate).not.toHaveBeenCalled()
  })
})
