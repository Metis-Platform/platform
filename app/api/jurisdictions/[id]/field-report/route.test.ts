import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ auth: vi.fn(), sync: vi.fn(), findUnique: vi.fn(), auditCreate: vi.fn() }))

vi.mock('@clerk/nextjs/server', () => ({ auth: mocks.auth }))
vi.mock('@/lib/sync-user', () => ({ syncUserToDatabase: mocks.sync }))
vi.mock('@/lib/db', () => ({
  db: {
    jurisdiction: { findUnique: mocks.findUnique },
    auditEvent: { create: mocks.auditCreate },
  },
}))

import { POST } from './route'

describe('jurisdiction field-report route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ userId: 'user-1', orgId: 'org-1' })
    mocks.sync.mockResolvedValue({ tenant: { id: 'tenant-1' } })
    mocks.findUnique.mockResolvedValue({ id: 'jurisdiction-1', county: 'Volusia', state: 'FL' })
    mocks.auditCreate.mockResolvedValue({})
  })

  it('records request-correlated target identity without copying the submitted report body', async () => {
    const reason = 'Private investor underwriting and contact information.'
    const response = await POST(new Request('https://metis.example/api/jurisdictions/jurisdiction-1/field-report', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-request-id': '00000000-0000-4000-8000-000000000488' },
      body: JSON.stringify({ strategy: 'TAX_DEED', section: 'taxSale', fieldKey: 'redemptionPeriodDays', label: 'Redemption period', reason }),
    }), { params: Promise.resolve({ id: 'jurisdiction-1' }) })

    expect(response.status).toBe(200)
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-1', userId: 'user-1', requestId: '00000000-0000-4000-8000-000000000488',
        action: 'JURISDICTION_PROFILE_FLAGGED', meta: { jurisdictionId: 'jurisdiction-1' },
      },
    })
    expect(JSON.stringify(mocks.auditCreate.mock.calls[0][0])).not.toContain(reason)
    expect(JSON.stringify(mocks.auditCreate.mock.calls[0][0])).not.toContain('redemptionPeriodDays')
  })
})
