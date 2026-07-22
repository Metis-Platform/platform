import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  currentUser: vi.fn(),
  hasRole: vi.fn(),
  findTask: vi.fn(),
  create: vi.fn(),
  auditCreate: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  getCurrentUser: mocks.currentUser,
  hasRole: mocks.hasRole,
}))
vi.mock('@/lib/db', () => ({
  db: {
    task: { findUnique: mocks.findTask },
    $transaction: async (callback: (tx: unknown) => unknown) => callback({
      taskComment: { create: mocks.create },
      auditEvent: { create: mocks.auditCreate },
    }),
  },
}))

import { POST } from './route'

describe('task comment route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.currentUser.mockResolvedValue({ tenant: { id: 'tenant-1' }, user: { id: 'analyst-1', role: 'MEMBER' } })
    mocks.hasRole.mockReturnValue(true)
    mocks.findTask.mockResolvedValue({ id: 'task-1', tenantId: 'tenant-1' })
    mocks.create.mockResolvedValue({
      id: 'comment-1',
      body: 'Sensitive seller negotiation details',
      createdAt: new Date('2026-07-21T00:00:00.000Z'),
      user: { id: 'analyst-1', name: 'Analyst', email: 'analyst@example.com' },
    })
  })

  const request = (body = 'Sensitive seller negotiation details') => new Request('https://metis.example/api/tasks/task-1/comments', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-request-id': '00000000-0000-4000-8000-000000000121' },
    body: JSON.stringify({ body }),
  }) as NextRequest

  it('atomically records a correlated comment create without comment content or user PII', async () => {
    const response = await POST(request(), { params: Promise.resolve({ id: 'task-1' }) })

    expect(response.status).toBe(200)
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-1', userId: 'analyst-1', requestId: '00000000-0000-4000-8000-000000000121',
        action: 'TASK_COMMENT_CREATED', meta: { taskId: 'task-1', commentId: 'comment-1' },
      },
    })
    const audit = JSON.stringify(mocks.auditCreate.mock.calls[0][0])
    expect(audit).not.toContain('Sensitive seller negotiation details')
    expect(audit).not.toContain('analyst@example.com')
  })

  it('does not create a comment or audit event for a foreign task', async () => {
    mocks.findTask.mockResolvedValue({ id: 'task-1', tenantId: 'tenant-2' })

    const response = await POST(request(), { params: Promise.resolve({ id: 'task-1' }) })

    expect(response.status).toBe(404)
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.auditCreate).not.toHaveBeenCalled()
  })
})
