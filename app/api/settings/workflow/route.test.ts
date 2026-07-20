import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  create: vi.fn(),
  auditCreate: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ getCurrentUser: mocks.getCurrentUser }))
vi.mock('@/lib/db', () => ({
  db: {
    $transaction: async (callback: (tx: unknown) => unknown) => callback({
      tenantWorkflowRule: { create: mocks.create },
      auditEvent: { create: mocks.auditCreate },
    }),
  },
}))

import { POST } from './route'

describe('workflow rules route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCurrentUser.mockResolvedValue({
      tenant: { id: 'tenant-1' }, user: { id: 'user-1' },
    })
    mocks.create.mockResolvedValue({ id: 'rule-1', strategy: 'TAX_LIEN' })
  })

  it('creates a rule and a request-correlated audit event without action configuration', async () => {
    const actionConfig = { taskTitle: 'Private workflow title', priority: 'HIGH' }
    const response = await POST(new Request('https://metis.example/api/settings/workflow', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-request-id': '00000000-0000-4000-8000-000000000011' },
      body: JSON.stringify({
        strategy: 'TAX_LIEN', name: 'Before deadline', triggerEvent: 'AUCTION_DATE', offsetDays: -7,
        action: 'CREATE_TASK', actionConfig,
      }),
    }))

    expect(response.status).toBe(200)
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-1', userId: 'user-1', requestId: '00000000-0000-4000-8000-000000000011',
        action: 'WORKFLOW_RULE_CREATED', meta: { workflowRuleId: 'rule-1', strategy: 'TAX_LIEN' },
      },
    })
    expect(JSON.stringify(mocks.auditCreate.mock.calls[0][0])).not.toContain('Private workflow title')
  })
})
