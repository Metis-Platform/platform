import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(), findDeal: vi.fn(), create: vi.fn(), auditCreate: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ getCurrentUser: mocks.getCurrentUser, hasRole: (role: string) => role === 'ANALYST' }))
vi.mock('@/lib/db', () => ({
  db: {
    deal: { findUnique: mocks.findDeal },
    $transaction: async (callback: (tx: unknown) => unknown) => callback({
      financialTransaction: { create: mocks.create }, auditEvent: { create: mocks.auditCreate },
    }),
  },
}))

import { POST } from './route'

describe('deal transactions route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCurrentUser.mockResolvedValue({ tenant: { id: 'tenant-1' }, user: { id: 'analyst-1', role: 'ANALYST' } })
    mocks.findDeal.mockResolvedValue({ id: 'deal-1', tenantId: 'tenant-1' })
    mocks.create.mockResolvedValue({ id: 'transaction-1' })
  })

  it('atomically records a correlated transaction create without financial data', async () => {
    const amount = 125000
    const response = await POST(new Request('https://metis.example/api/deals/deal-1/transactions', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-request-id': '00000000-0000-4000-8000-000000000071' },
      body: JSON.stringify({ type: 'PURCHASE', amount, date: '2026-07-20', description: 'Private acquisition detail' }),
    }) as NextRequest, { params: Promise.resolve({ id: 'deal-1' }) })

    expect(response.status).toBe(201)
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-1', userId: 'analyst-1', requestId: '00000000-0000-4000-8000-000000000071',
        action: 'FINANCIAL_TRANSACTION_CREATED', meta: { transactionId: 'transaction-1', dealId: 'deal-1' },
      },
    })
    expect(JSON.stringify(mocks.auditCreate.mock.calls[0][0])).not.toContain(String(amount))
  })

  it('does not write a transaction or audit event for a foreign deal', async () => {
    mocks.findDeal.mockResolvedValue({ id: 'deal-2', tenantId: 'tenant-2' })
    const response = await POST(new Request('https://metis.example/api/deals/deal-2/transactions', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'PURCHASE', amount: 1, date: '2026-07-20' }),
    }) as NextRequest, { params: Promise.resolve({ id: 'deal-2' }) })
    expect(response.status).toBe(404)
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.auditCreate).not.toHaveBeenCalled()
  })
})
