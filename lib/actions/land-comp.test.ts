import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ auth: vi.fn(), tenant: vi.fn(), hasStrategy: vi.fn(), headers: vi.fn(), findDeal: vi.fn(), create: vi.fn(), remove: vi.fn(), audit: vi.fn(), revalidate: vi.fn() }))
vi.mock('@clerk/nextjs/server', () => ({ auth: mocks.auth }))
vi.mock('next/headers', () => ({ headers: mocks.headers }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }))
vi.mock('@/lib/entitlements', () => ({ hasStrategy: mocks.hasStrategy }))
vi.mock('@/lib/db', () => ({ db: { tenant: { findUnique: mocks.tenant }, deal: { findUnique: mocks.findDeal }, $transaction: async (callback: (tx: unknown) => unknown) => callback({ landComp: { create: mocks.create, deleteMany: mocks.remove }, auditEvent: { create: mocks.audit } }) } }))
import { createLandComp, deleteLandComp } from './land-comp'

describe('land comp actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ userId: 'user-1', orgId: 'org-1' })
    mocks.tenant.mockResolvedValue({ id: 'tenant-1' })
    mocks.hasStrategy.mockResolvedValue(true)
    mocks.headers.mockResolvedValue(new Headers({ 'x-request-id': '00000000-0000-4000-8000-000000000520' }))
    mocks.findDeal.mockResolvedValue({ id: 'deal-1' })
    mocks.create.mockResolvedValue({ id: 'comp-1' })
    mocks.remove.mockResolvedValue({ count: 1 })
  })

  it('atomically traces a comp create without pricing metadata', async () => {
    const form = new FormData()
    form.set('acres', '2'); form.set('salePrice', '150000'); form.set('saleDate', '2026-01-01')
    await createLandComp('deal-1', {}, form)
    expect(mocks.audit).toHaveBeenCalledWith({ data: { tenantId: 'tenant-1', userId: 'user-1', requestId: '00000000-0000-4000-8000-000000000520', action: 'LAND_COMP_CREATED', meta: { dealId: 'deal-1', compId: 'comp-1' } } })
    expect(JSON.stringify(mocks.audit.mock.calls[0][0])).not.toContain('150000')
  })

  it('traces only an actually deleted tenant comp', async () => {
    await deleteLandComp('deal-1', 'comp-1')
    expect(mocks.audit).toHaveBeenCalledWith({ data: { tenantId: 'tenant-1', userId: 'user-1', requestId: '00000000-0000-4000-8000-000000000520', action: 'LAND_COMP_DELETED', meta: { dealId: 'deal-1', compId: 'comp-1' } } })
    mocks.audit.mockClear(); mocks.remove.mockResolvedValue({ count: 0 })
    await deleteLandComp('deal-1', 'foreign-comp')
    expect(mocks.audit).not.toHaveBeenCalled()
  })
})
