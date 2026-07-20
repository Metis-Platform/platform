import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ sync: vi.fn(), upsert: vi.fn(), audit: vi.fn() }))
vi.mock('@/lib/sync-user', () => ({ syncUserToDatabase: mocks.sync }))
vi.mock('@/lib/auth', () => ({ hasRole: (role: string) => role === 'OWNER' }))
vi.mock('@/lib/db', () => ({ db: { $transaction: async (cb: (tx: unknown) => unknown) => cb({ investorProfile: { upsert: mocks.upsert }, auditEvent: { create: mocks.audit } }) } }))
import { POST } from './route'
describe('investor profile route', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.sync.mockResolvedValue({ tenant: { id: 'tenant-1' }, user: { id: 'owner-1', role: 'OWNER' } }); mocks.upsert.mockResolvedValue({ id: 'profile-1' }) })
  it('atomically records a safe owner profile change without assumptions', async () => {
    const secret = 250000
    const response = await POST(new Request('https://metis.example/api/tenants/investor-profile', { method: 'POST', headers: { 'content-type': 'application/json', 'x-request-id': '00000000-0000-4000-8000-000000000031' }, body: JSON.stringify({ maxPurchasePrice: secret }) }))
    expect(response.status).toBe(200)
    expect(mocks.audit).toHaveBeenCalledWith({ data: { tenantId: 'tenant-1', userId: 'owner-1', requestId: '00000000-0000-4000-8000-000000000031', action: 'INVESTOR_PROFILE_UPDATED', meta: { profileId: 'profile-1' } } })
    expect(JSON.stringify(mocks.audit.mock.calls[0][0])).not.toContain(String(secret))
  })
  it('refuses a non-owner before any assumption or audit write', async () => {
    mocks.sync.mockResolvedValue({ tenant: { id: 'tenant-1' }, user: { id: 'member-1', role: 'ANALYST' } })
    const response = await POST(new Request('https://metis.example/api/tenants/investor-profile', { method: 'POST', body: JSON.stringify({}) }))
    expect(response.status).toBe(403); expect(mocks.upsert).not.toHaveBeenCalled(); expect(mocks.audit).not.toHaveBeenCalled()
  })
})
