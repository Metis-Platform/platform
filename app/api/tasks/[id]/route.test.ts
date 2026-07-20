import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  syncUserToDatabase: vi.fn(),
  getCurrentUser: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  auditCreate: vi.fn(),
}))

vi.mock('@clerk/nextjs/server', () => ({ auth: mocks.auth }))
vi.mock('@/lib/sync-user', () => ({ syncUserToDatabase: mocks.syncUserToDatabase }))
vi.mock('@/lib/auth', () => ({
  getCurrentUser: mocks.getCurrentUser,
  hasRole: (role: string) => role === 'ANALYST',
}))
vi.mock('@/lib/db', () => ({
  db: {
    $transaction: async (callback: (tx: unknown) => unknown) => callback({
      task: { findFirst: mocks.findFirst, update: mocks.update, delete: mocks.delete },
      user: { findFirst: vi.fn() },
      auditEvent: { create: mocks.auditCreate },
    }),
  },
}))

import { DELETE, PATCH } from './route'

describe('task lifecycle route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ userId: 'clerk-1', orgId: 'org-1' })
    mocks.syncUserToDatabase.mockResolvedValue({ tenant: { id: 'tenant-1' }, user: { id: 'analyst-1' } })
    mocks.getCurrentUser.mockResolvedValue({ tenant: { id: 'tenant-1' }, user: { id: 'analyst-1', role: 'ANALYST' } })
    mocks.findFirst.mockResolvedValue({ id: 'task-1' })
    mocks.update.mockResolvedValue({ id: 'task-1' })
  })

  it('atomically records a correlated update without changed task values', async () => {
    const response = await PATCH(new Request('https://metis.example/api/tasks/task-1', {
      method: 'PATCH', headers: { 'content-type': 'application/json', 'x-request-id': '00000000-0000-4000-8000-000000000061' },
      body: JSON.stringify({ title: 'Private revised instruction', status: 'COMPLETED' }),
    }) as NextRequest, { params: Promise.resolve({ id: 'task-1' }) })

    expect(response.status).toBe(200)
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-1', userId: 'analyst-1', requestId: '00000000-0000-4000-8000-000000000061',
        action: 'TASK_UPDATED', meta: { taskId: 'task-1' },
      },
    })
    expect(JSON.stringify(mocks.auditCreate.mock.calls[0][0])).not.toContain('Private revised instruction')
  })

  it('records a correlated deletion only after finding the tenant task in the transaction', async () => {
    const response = await DELETE(new Request('https://metis.example/api/tasks/task-1', {
      method: 'DELETE', headers: { 'x-request-id': '00000000-0000-4000-8000-000000000062' },
    }) as NextRequest, { params: Promise.resolve({ id: 'task-1' }) })

    expect(response.status).toBe(200)
    expect(mocks.delete).toHaveBeenCalledWith({ where: { id: 'task-1' } })
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-1', userId: 'analyst-1', requestId: '00000000-0000-4000-8000-000000000062',
        action: 'TASK_DELETED', meta: { taskId: 'task-1' },
      },
    })
  })

  it('does not write an audit event when the task is not in the tenant', async () => {
    mocks.findFirst.mockResolvedValue(null)
    const response = await DELETE(new Request('https://metis.example/api/tasks/foreign', { method: 'DELETE' }) as NextRequest, { params: Promise.resolve({ id: 'foreign' }) })
    expect(response.status).toBe(404)
    expect(mocks.delete).not.toHaveBeenCalled()
    expect(mocks.auditCreate).not.toHaveBeenCalled()
  })
})
