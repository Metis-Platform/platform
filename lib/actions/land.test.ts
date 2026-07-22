import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ auth: vi.fn(), tenant: vi.fn(), hasStrategy: vi.fn(), property: vi.fn(), deal: vi.fn(), audit: vi.fn(), headers: vi.fn(), redirect: vi.fn(), landEvents: vi.fn(), workflowRules: vi.fn() }))
vi.mock('@clerk/nextjs/server', () => ({ auth: mocks.auth }))
vi.mock('next/headers', () => ({ headers: mocks.headers }))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))
vi.mock('@/lib/entitlements', () => ({ hasStrategy: mocks.hasStrategy }))
vi.mock('@/lib/land-events', () => ({ generateLandEvents: mocks.landEvents }))
vi.mock('@/lib/workflow-rules', () => ({ applyTenantWorkflowRules: mocks.workflowRules }))
vi.mock('@/lib/db', () => ({ db: { tenant: { findUnique: mocks.tenant }, property: { upsert: mocks.property }, $transaction: async (callback: (tx: unknown) => unknown) => callback({ deal: { create: mocks.deal }, auditEvent: { create: mocks.audit } }) } }))

import { createLand } from './land'

describe('createLand', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ userId: 'user-1', orgId: 'org-1' })
    mocks.tenant.mockResolvedValue({ id: 'tenant-1' })
    mocks.hasStrategy.mockResolvedValue(true)
    mocks.property.mockResolvedValue({ id: 'property-1' })
    mocks.deal.mockResolvedValue({ id: 'deal-1' })
    mocks.headers.mockResolvedValue(new Headers({ 'x-request-id': '00000000-0000-4000-8000-000000000512' }))
  })

  it('atomically traces creation without investor-entered property or economics data', async () => {
    const form = new FormData()
    form.set('jurisdictionId', 'jurisdiction-1'); form.set('apn', 'sensitive-apn'); form.set('address', 'Sensitive Address')
    form.set('purchasePrice', '150000'); form.set('notes', 'Sensitive notes')

    await createLand({}, form)

    expect(mocks.audit).toHaveBeenCalledWith({ data: { tenantId: 'tenant-1', userId: 'user-1', requestId: '00000000-0000-4000-8000-000000000512', action: 'DEAL_CREATED', meta: { dealId: 'deal-1' } } })
    expect(JSON.stringify(mocks.audit.mock.calls[0][0])).not.toMatch(/sensitive-apn|Sensitive Address|150000|Sensitive notes/)
    expect(mocks.landEvents).toHaveBeenCalledWith('deal-1', 'tenant-1')
    expect(mocks.workflowRules).toHaveBeenCalledWith('tenant-1', 'deal-1')
  })
})
