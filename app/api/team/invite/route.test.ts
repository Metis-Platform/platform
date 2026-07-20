import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  clerkClient: vi.fn(),
  createOrganizationInvitation: vi.fn(),
  getCurrentUser: vi.fn(),
  auditCreate: vi.fn(),
}))

vi.mock('@clerk/nextjs/server', () => ({ auth: mocks.auth, clerkClient: mocks.clerkClient }))
vi.mock('@/lib/auth', () => ({ getCurrentUser: mocks.getCurrentUser, hasRole: (role: string) => role === 'OWNER' }))
vi.mock('@/lib/db', () => ({ db: { auditEvent: { create: mocks.auditCreate } } }))

import { POST } from './route'

describe('team invitation route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ orgId: 'org-1' })
    mocks.getCurrentUser.mockResolvedValue({
      tenant: { id: 'tenant-1' }, user: { id: 'local-user-1', clerkUserId: 'clerk-user-1', role: 'OWNER' },
    })
    mocks.clerkClient.mockResolvedValue({ organizations: { createOrganizationInvitation: mocks.createOrganizationInvitation } })
  })

  it('records a request-correlated tenant audit event without the invitee email', async () => {
    const response = await POST(new Request('https://metis.example/api/team/invite', {
      method: 'POST',
      headers: { 'x-request-id': '00000000-0000-4000-8000-000000000001' },
      body: JSON.stringify({ email: 'member@example.test' }),
    }))

    expect(response.status).toBe(200)
    expect(mocks.createOrganizationInvitation).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 'org-1', emailAddress: 'member@example.test' }))
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-1', userId: 'local-user-1', requestId: '00000000-0000-4000-8000-000000000001',
        action: 'TEAM_MEMBER_INVITED', meta: { organizationId: 'org-1' },
      },
    })
    expect(JSON.stringify(mocks.auditCreate.mock.calls[0][0])).not.toContain('member@example.test')
  })
})
