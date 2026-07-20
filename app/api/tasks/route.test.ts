import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  syncUserToDatabase: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  auditCreate: vi.fn(),
}))

vi.mock('@/lib/sync-user', () => ({ syncUserToDatabase: mocks.syncUserToDatabase }))
vi.mock('@/lib/db', () => ({
  db: {
    deal: { findUnique: mocks.findUnique },
    $transaction: async (callback: (tx: unknown) => unknown) => callback({
      task: { create: mocks.create },
      auditEvent: { create: mocks.auditCreate },
      user: { findFirst: vi.fn() },
    }),
  },
}))

import { POST } from './route'

describe('tasks route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.syncUserToDatabase.mockResolvedValue({
      tenant: { id: 'tenant-1' }, user: { id: 'analyst-1' },
    })
    mocks.findUnique.mockResolvedValue({ id: 'deal-1', tenantId: 'tenant-1' })
    mocks.create.mockResolvedValue({ id: 'task-1', assignedTo: null })
  })

  it('atomically records a correlated task create without task content', async () => {
    const title = 'Private acquisition instruction'
    const response = await POST(new Request('https://metis.example/api/tasks', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-request-id': '00000000-0000-4000-8000-000000000051' },
      body: JSON.stringify({ dealId: 'deal-1', title, description: 'Private notes' }),
    }))

    expect(response.status).toBe(201)
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-1', userId: 'analyst-1', requestId: '00000000-0000-4000-8000-000000000051',
        action: 'TASK_CREATED', meta: { taskId: 'task-1', dealId: 'deal-1' },
      },
    })
    expect(JSON.stringify(mocks.auditCreate.mock.calls[0][0])).not.toContain(title)
  })

  it('does not create a task or audit event for a different tenant deal', async () => {
    mocks.findUnique.mockResolvedValue({ id: 'deal-2', tenantId: 'tenant-2' })
    const response = await POST(new Request('https://metis.example/api/tasks', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dealId: 'deal-2', title: 'Ignored' }),
    }))
    expect(response.status).toBe(404)
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.auditCreate).not.toHaveBeenCalled()
  })
})
