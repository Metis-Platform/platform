import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({ auth: vi.fn(), sync: vi.fn(), findDeal: vi.fn(), create: vi.fn(), auditCreate: vi.fn() }))
vi.mock('@clerk/nextjs/server', () => ({ auth: mocks.auth }))
vi.mock('@/lib/sync-user', () => ({ syncUserToDatabase: mocks.sync }))
vi.mock('@/lib/db', () => ({
  db: {
    deal: { findUnique: mocks.findDeal },
    $transaction: async (callback: (tx: unknown) => unknown) => callback({ document: { create: mocks.create }, auditEvent: { create: mocks.auditCreate } }),
  },
}))

import { POST } from './route'

describe('documents route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ userId: 'clerk-1', orgId: 'org-1' })
    mocks.sync.mockResolvedValue({ tenant: { id: 'tenant-1' }, user: { id: 'analyst-1' } })
    mocks.findDeal.mockResolvedValue({ id: 'deal-1', tenantId: 'tenant-1' })
    mocks.create.mockResolvedValue({ id: 'document-1' })
  })
  const request = (dealId: string) => new Request('https://metis.example/api/documents', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-request-id': '00000000-0000-4000-8000-000000000101' },
    body: JSON.stringify({ dealId, fileName: 'private-title-report.pdf', fileSize: 100, mimeType: 'application/pdf', r2Key: 'tenants/tenant-1/deals/deal-1/a.pdf', docType: 'TITLE_REPORT' }),
  }) as NextRequest

  it('atomically records a document creation without document metadata', async () => {
    const response = await POST(request('deal-1'))
    expect(response.status).toBe(201)
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: { tenantId: 'tenant-1', userId: 'analyst-1', requestId: '00000000-0000-4000-8000-000000000101', action: 'DOCUMENT_CREATED', meta: { documentId: 'document-1', dealId: 'deal-1' } },
    })
    expect(JSON.stringify(mocks.auditCreate.mock.calls[0][0])).not.toContain('private-title-report.pdf')
  })
  it('does not create or audit a document for a foreign deal', async () => {
    mocks.findDeal.mockResolvedValue({ id: 'foreign-deal', tenantId: 'tenant-2' })
    const response = await POST(request('foreign-deal'))
    expect(response.status).toBe(404)
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.auditCreate).not.toHaveBeenCalled()
  })
})
