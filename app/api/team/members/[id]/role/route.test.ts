import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  auditCreate: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ getCurrentUser: mocks.getCurrentUser, hasRole: (role: string) => role === 'OWNER' }))
vi.mock('@/lib/db', () => ({
  db: {
    $transaction: async (callback: (tx: unknown) => unknown) => callback({
      user: { findUnique: mocks.findUnique, update: mocks.update },
      auditEvent: { create: mocks.auditCreate },
    }),
  },
}))

import { PATCH } from './route'

describe('team role route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCurrentUser.mockResolvedValue({
      tenant: { id: 'tenant-1' }, user: { id: 'local-owner-1', role: 'OWNER' },
    })
    mocks.findUnique.mockResolvedValue({ id: 'member-1', tenantId: 'tenant-1' })
    mocks.update.mockResolvedValue({ id: 'member-1', role: 'ANALYST' })
  })

  it('changes a same-tenant role and records an atomic request-correlated audit event', async () => {
    const response = await PATCH(new Request('https://metis.example/api/team/members/member-1/role', {
      method: 'PATCH',
      headers: { 'x-request-id': '00000000-0000-4000-8000-000000000002' },
      body: JSON.stringify({ role: 'ANALYST' }),
    }), { params: Promise.resolve({ id: 'member-1' }) })

    expect(response.status).toBe(200)
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-1', userId: 'local-owner-1', requestId: '00000000-0000-4000-8000-000000000002',
        action: 'TEAM_MEMBER_ROLE_CHANGED', meta: { memberId: 'member-1', role: 'ANALYST' },
      },
    })
  })

  it('refuses a cross-tenant member before any role or audit write', async () => {
    mocks.findUnique.mockResolvedValue({ id: 'member-2', tenantId: 'tenant-2' })
    const response = await PATCH(new Request('https://metis.example/api/team/members/member-2/role', {
      method: 'PATCH', body: JSON.stringify({ role: 'ANALYST' }),
    }), { params: Promise.resolve({ id: 'member-2' }) })

    expect(response.status).toBe(404)
    expect(mocks.update).not.toHaveBeenCalled()
    expect(mocks.auditCreate).not.toHaveBeenCalled()
  })
})
