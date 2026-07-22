import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  isSuperAdmin: vi.fn(), currentUser: vi.fn(), syncUserToDatabase: vi.fn(), publishCanonicalAcceptance: vi.fn(),
}))

vi.mock('@/lib/admin-auth', () => ({ isSuperAdmin: mocks.isSuperAdmin }))
vi.mock('@clerk/nextjs/server', () => ({ currentUser: mocks.currentUser }))
vi.mock('@/lib/sync-user', () => ({ syncUserToDatabase: mocks.syncUserToDatabase }))
vi.mock('@/lib/jurisdiction-canonical-acceptance', () => ({ publishCanonicalAcceptance: mocks.publishCanonicalAcceptance }))

import { POST } from './route'

const body = {
  contractVersion: '2026-07-20.v1', caseReference: 'county-fixture-1',
  evidenceUrl: 'https://github.com/Metis-Platform/platform/actions/runs/123',
  result: 'PASSED', summary: 'The complete county acceptance case passed against the current contract.',
}

describe('canonical acceptance route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.isSuperAdmin.mockResolvedValue(true)
    mocks.currentUser.mockResolvedValue({ id: 'clerk-reviewer-1' })
    mocks.syncUserToDatabase.mockResolvedValue({ tenant: { id: 'tenant-1' }, user: { id: 'user-1' } })
    mocks.publishCanonicalAcceptance.mockResolvedValue({ acceptanceId: 'acceptance-1', result: 'PASSED', reviewedAt: new Date() })
  })

  it('requires a super-admin', async () => {
    mocks.isSuperAdmin.mockResolvedValue(false)
    const response = await POST(new Request('https://metis.example/api/admin/jurisdictions/j-1/canonical-acceptance', { method: 'POST', body: JSON.stringify(body) }), { params: Promise.resolve({ id: 'j-1' }) })
    expect(response.status).toBe(403)
    expect(mocks.publishCanonicalAcceptance).not.toHaveBeenCalled()
  })

  it('records a global acceptance with a tenant-correlated, nonsensitive audit event', async () => {
    const response = await POST(new Request('https://metis.example/api/admin/jurisdictions/j-1/canonical-acceptance', { method: 'POST', headers: { 'x-request-id': '11111111-1111-4111-8111-111111111111' }, body: JSON.stringify(body) }), { params: Promise.resolve({ id: 'j-1' }) })
    expect(response.status).toBe(201)
    expect(mocks.publishCanonicalAcceptance).toHaveBeenCalledWith(expect.objectContaining({
      jurisdictionId: 'j-1', reviewerId: 'clerk-reviewer-1', result: 'PASSED',
      auditEvent: expect.objectContaining({
        tenantId: 'tenant-1', userId: 'user-1', requestId: '11111111-1111-4111-8111-111111111111',
        action: 'JURISDICTION_CANONICAL_ACCEPTANCE_RECORDED',
        meta: { jurisdictionId: 'j-1', result: 'PASSED', contractVersion: '2026-07-20.v1' },
      }),
    }))
    const auditMeta = mocks.publishCanonicalAcceptance.mock.calls[0][0].auditEvent.meta
    expect(JSON.stringify(auditMeta)).not.toContain(body.summary)
    expect(JSON.stringify(auditMeta)).not.toContain(body.evidenceUrl)
  })
})
