import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  findUnique: vi.fn(),
  findMany: vi.fn(),
  createMany: vi.fn(),
  auditCreate: vi.fn(),
  computeMissingItems: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  getCurrentUser: mocks.getCurrentUser,
  hasRole: (role: string) => role === 'ANALYST',
}))
vi.mock('@/lib/db', () => ({
  db: {
    deal: { findUnique: mocks.findUnique },
    task: { findMany: mocks.findMany, create: {} },
    $transaction: async (callback: (tx: unknown) => unknown) => callback({
      task: { createMany: mocks.createMany },
      auditEvent: { create: mocks.auditCreate },
    }),
  },
}))
vi.mock('@/lib/checklists/instantiate', () => ({ computeMissingItems: mocks.computeMissingItems }))
vi.mock('@/lib/jurisdiction-checklist', () => ({ buildJurisdictionChecklistTemplate: () => ({}) }))
vi.mock('@/lib/jurisdiction-research', () => ({
  buildResearchProfile: () => ({}),
  retainActiveClaimBackedResearchFields: (profile: unknown) => profile,
}))

import { POST } from './route'

describe('deal checklist route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCurrentUser.mockResolvedValue({
      tenant: { id: 'tenant-1' }, user: { id: 'analyst-1', role: 'ANALYST' },
    })
    mocks.findUnique.mockResolvedValue({
      strategyType: 'TAX_LIEN', purchaseDate: null, property: { jurisdiction: { profile: null, claims: [] } },
      taxLien: null, taxDeed: null, foreclosure: null, land: null,
    })
    mocks.findMany.mockResolvedValue([])
    mocks.computeMissingItems.mockReturnValue([{
      checklistKey: 'title-search', title: 'Private title instruction', description: 'Sensitive fixture text',
      taskType: 'ORDER_TITLE_SEARCH', priority: 'HIGH', dueDate: null,
    }])
  })

  it('atomically records a correlated checklist batch without task text', async () => {
    const response = await POST(new Request('https://metis.example/api/deals/deal-1/checklist', {
      method: 'POST', headers: { 'x-request-id': '00000000-0000-4000-8000-000000000041' },
    }) as NextRequest, { params: Promise.resolve({ id: 'deal-1' }) })

    expect(response.status).toBe(201)
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-1', userId: 'analyst-1', requestId: '00000000-0000-4000-8000-000000000041',
        action: 'CHECKLIST_CREATED', meta: { dealId: 'deal-1', created: 1 },
      },
    })
    expect(JSON.stringify(mocks.auditCreate.mock.calls[0][0])).not.toContain('Private title instruction')
  })

  it('does not audit an idempotent repeat', async () => {
    mocks.computeMissingItems.mockReturnValue([])
    const response = await POST(new Request('https://metis.example/api/deals/deal-1/checklist', { method: 'POST' }) as NextRequest, { params: Promise.resolve({ id: 'deal-1' }) })
    expect(response.status).toBe(200)
    expect(mocks.createMany).not.toHaveBeenCalled()
    expect(mocks.auditCreate).not.toHaveBeenCalled()
  })
})
