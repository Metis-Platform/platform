import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  auditCreate: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ getCurrentUser: mocks.getCurrentUser }))
vi.mock('@/lib/db', () => ({
  db: {
    $transaction: async (callback: (tx: unknown) => unknown) => callback({
      tenantWorkflowRule: { findFirst: mocks.findFirst, update: mocks.update, delete: mocks.remove },
      auditEvent: { create: mocks.auditCreate },
    }),
  },
}))

import { DELETE, PATCH } from './route'

describe('workflow rule by id route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCurrentUser.mockResolvedValue({
      tenant: { id: 'tenant-1' }, user: { id: 'user-1' },
    })
    mocks.findFirst.mockResolvedValue({ id: 'rule-1', tenantId: 'tenant-1', strategy: 'TAX_LIEN' })
    mocks.update.mockResolvedValue({ id: 'rule-1', isActive: false })
  })

  it('updates a same-tenant rule and records an atomic request-correlated event', async () => {
    const response = await PATCH(new Request('https://metis.example/api/settings/workflow/rule-1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'x-request-id': '00000000-0000-4000-8000-000000000012' },
      body: JSON.stringify({ isActive: false }),
    }), { params: Promise.resolve({ id: 'rule-1' }) })

    expect(response.status).toBe(200)
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-1', userId: 'user-1', requestId: '00000000-0000-4000-8000-000000000012',
        action: 'WORKFLOW_RULE_UPDATED', meta: { workflowRuleId: 'rule-1', isActive: false },
      },
    })
  })

  it('deletes a same-tenant rule and records only safe metadata', async () => {
    const response = await DELETE(new Request('https://metis.example/api/settings/workflow/rule-1', {
      method: 'DELETE', headers: { 'x-request-id': '00000000-0000-4000-8000-000000000013' },
    }), { params: Promise.resolve({ id: 'rule-1' }) })

    expect(response.status).toBe(200)
    expect(mocks.remove).toHaveBeenCalledWith({ where: { id: 'rule-1' } })
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-1', userId: 'user-1', requestId: '00000000-0000-4000-8000-000000000013',
        action: 'WORKFLOW_RULE_DELETED', meta: { workflowRuleId: 'rule-1', strategy: 'TAX_LIEN' },
      },
    })
  })

  it('refuses a missing or cross-tenant rule before any mutation or audit write', async () => {
    mocks.findFirst.mockResolvedValue(null)
    const response = await DELETE(new Request('https://metis.example/api/settings/workflow/rule-2', { method: 'DELETE' }), {
      params: Promise.resolve({ id: 'rule-2' }),
    })

    expect(response.status).toBe(404)
    expect(mocks.remove).not.toHaveBeenCalled()
    expect(mocks.auditCreate).not.toHaveBeenCalled()
  })
})
