import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  tenant: vi.fn(),
  hasStrategy: vi.fn(),
  property: vi.fn(),
  deal: vi.fn(),
  audit: vi.fn(),
  claimSnapshot: vi.fn(),
  updateSnapshot: vi.fn(),
  headers: vi.fn(),
  redirect: vi.fn(),
  generateEvents: vi.fn(),
  applyWorkflowRules: vi.fn(),
}))

vi.mock('@clerk/nextjs/server', () => ({ auth: mocks.auth }))
vi.mock('next/headers', () => ({ headers: mocks.headers }))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))
vi.mock('@/lib/entitlements', () => ({ hasStrategy: mocks.hasStrategy }))
vi.mock('@/lib/rules-engine', () => ({ generateEventsForDeal: mocks.generateEvents }))
vi.mock('@/lib/workflow-rules', () => ({ applyTenantWorkflowRules: mocks.applyWorkflowRules }))
vi.mock('@/lib/db', () => ({
  db: {
    tenant: { findUnique: mocks.tenant },
    property: { upsert: mocks.property },
    $transaction: async (callback: (tx: unknown) => unknown) => callback({
      deal: { create: mocks.deal },
      auditEvent: { create: mocks.audit },
      prePurchaseResearchSnapshot: { updateMany: mocks.claimSnapshot, update: mocks.updateSnapshot },
      property: { upsert: mocks.property },
    }),
  },
}))

import { createDeed, createForeclosure, createLien } from './lien'

describe('createLien', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ userId: 'user-1', orgId: 'org-1' })
    mocks.tenant.mockResolvedValue({ id: 'tenant-1' })
    mocks.hasStrategy.mockResolvedValue(true)
    mocks.property.mockResolvedValue({ id: 'property-1' })
    mocks.deal.mockResolvedValue({ id: 'deal-1' })
    mocks.headers.mockResolvedValue(new Headers({ 'x-request-id': '00000000-0000-4000-8000-000000000512' }))
  })

  it('atomically traces a lead creation without APN, bid, address, or notes', async () => {
    const form = new FormData()
    form.set('status', 'LEAD'); form.set('jurisdictionId', 'jurisdiction-1'); form.set('apn', 'sensitive-apn')
    form.set('address', 'Sensitive Address'); form.set('maxBid', '150000'); form.set('notes', 'Sensitive notes')

    await createLien({}, form)

    expect(mocks.audit).toHaveBeenCalledWith({
      data: { tenantId: 'tenant-1', userId: 'user-1', requestId: '00000000-0000-4000-8000-000000000512', action: 'DEAL_CREATED', meta: { dealId: 'deal-1' } },
    })
    expect(JSON.stringify(mocks.audit.mock.calls[0][0])).not.toMatch(/sensitive-apn|Sensitive Address|150000|Sensitive notes/)
  })

  it('atomically traces active creation before scheduling follow-on workflow work', async () => {
    const form = new FormData()
    form.set('status', 'ACTIVE'); form.set('jurisdictionId', 'jurisdiction-1'); form.set('apn', 'apn-1')
    form.set('certificateNumber', 'certificate-1'); form.set('faceAmount', '1000'); form.set('interestRate', '18'); form.set('issueDate', '2026-01-01')

    await createLien({}, form)

    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'DEAL_CREATED', meta: { dealId: 'deal-1' } }) }))
    expect(mocks.generateEvents).toHaveBeenCalledWith('deal-1', 'tenant-1')
    expect(mocks.applyWorkflowRules).toHaveBeenCalledWith('tenant-1', 'deal-1')
  })
})

describe('createDeed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ userId: 'user-1', orgId: 'org-1' })
    mocks.tenant.mockResolvedValue({ id: 'tenant-1' })
    mocks.hasStrategy.mockResolvedValue(true)
    mocks.property.mockResolvedValue({ id: 'property-1' })
    mocks.deal.mockResolvedValue({ id: 'deal-1' })
    mocks.headers.mockResolvedValue(new Headers({ 'x-request-id': '00000000-0000-4000-8000-000000000512' }))
  })

  it('atomically traces a lead creation without property or bid data', async () => {
    const form = new FormData()
    form.set('status', 'LEAD'); form.set('jurisdictionId', 'jurisdiction-1'); form.set('apn', 'sensitive-apn')
    form.set('address', 'Sensitive Address'); form.set('maxBid', '150000'); form.set('notes', 'Sensitive notes')

    await createDeed({}, form)

    expect(mocks.audit).toHaveBeenCalledWith({
      data: { tenantId: 'tenant-1', userId: 'user-1', requestId: '00000000-0000-4000-8000-000000000512', action: 'DEAL_CREATED', meta: { dealId: 'deal-1' } },
    })
    expect(JSON.stringify(mocks.audit.mock.calls[0][0])).not.toMatch(/sensitive-apn|Sensitive Address|150000|Sensitive notes/)
  })

  it('atomically traces active creation before scheduling deal events', async () => {
    const form = new FormData()
    form.set('status', 'ACTIVE'); form.set('jurisdictionId', 'jurisdiction-1'); form.set('apn', 'apn-1')
    form.set('saleDate', '2026-01-01'); form.set('winningBid', '1000')

    await createDeed({}, form)

    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'DEAL_CREATED', meta: { dealId: 'deal-1' } }) }))
    expect(mocks.generateEvents).toHaveBeenCalledWith('deal-1', 'tenant-1')
  })
})

describe('createForeclosure', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ userId: 'user-1', orgId: 'org-1' })
    mocks.tenant.mockResolvedValue({ id: 'tenant-1' })
    mocks.hasStrategy.mockResolvedValue(true)
    mocks.property.mockResolvedValue({ id: 'property-1' })
    mocks.deal.mockResolvedValue({ id: 'deal-1' })
    mocks.headers.mockResolvedValue(new Headers({ 'x-request-id': '00000000-0000-4000-8000-000000000512' }))
  })

  it('atomically traces a lead creation without property, bid, or lien data', async () => {
    const form = new FormData()
    form.set('status', 'LEAD'); form.set('jurisdictionId', 'jurisdiction-1'); form.set('apn', 'sensitive-apn')
    form.set('address', 'Sensitive Address'); form.set('maxBid', '150000'); form.set('estimatedLiens', '50000'); form.set('notes', 'Sensitive notes')

    await createForeclosure({}, form)

    expect(mocks.audit).toHaveBeenCalledWith({
      data: { tenantId: 'tenant-1', userId: 'user-1', requestId: '00000000-0000-4000-8000-000000000512', action: 'DEAL_CREATED', meta: { dealId: 'deal-1' } },
    })
    expect(JSON.stringify(mocks.audit.mock.calls[0][0])).not.toMatch(/sensitive-apn|Sensitive Address|150000|50000|Sensitive notes/)
  })

  it('atomically traces active creation before scheduling deal events', async () => {
    const form = new FormData()
    form.set('status', 'ACTIVE'); form.set('jurisdictionId', 'jurisdiction-1'); form.set('apn', 'apn-1')
    form.set('auctionDate', '2026-01-01'); form.set('winningBid', '1000')

    await createForeclosure({}, form)

    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'DEAL_CREATED', meta: { dealId: 'deal-1' } }) }))
    expect(mocks.generateEvents).toHaveBeenCalledWith('deal-1', 'tenant-1')
  })
})
