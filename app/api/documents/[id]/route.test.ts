import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({ auth: vi.fn(), sync: vi.fn(), findDocument: vi.fn(), deleteObject: vi.fn(), delete: vi.fn(), auditCreate: vi.fn() }))
vi.mock('@clerk/nextjs/server', () => ({ auth: mocks.auth }))
vi.mock('@/lib/sync-user', () => ({ syncUserToDatabase: mocks.sync }))
vi.mock('@/lib/r2', () => ({ deleteObject: mocks.deleteObject }))
vi.mock('@/lib/db', () => ({
  db: {
    document: { findUnique: mocks.findDocument },
    $transaction: async (callback: (tx: unknown) => unknown) => callback({ document: { delete: mocks.delete }, auditEvent: { create: mocks.auditCreate } }),
  },
}))

import { DELETE } from './route'

describe('document deletion route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ userId: 'clerk-1', orgId: 'org-1' })
    mocks.sync.mockResolvedValue({ tenant: { id: 'tenant-1' }, user: { id: 'analyst-1' } })
    mocks.findDocument.mockResolvedValue({ id: 'document-1', tenantId: 'tenant-1', dealId: 'deal-1', r2Key: 'tenants/tenant-1/deals/deal-1/a.pdf' })
  })
  it('records a correlated document deletion without document metadata', async () => {
    const response = await DELETE(new Request('https://metis.example/api/documents/document-1', { method: 'DELETE', headers: { 'x-request-id': '00000000-0000-4000-8000-000000000102' } }) as NextRequest, { params: Promise.resolve({ id: 'document-1' }) })
    expect(response.status).toBe(204)
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: { tenantId: 'tenant-1', userId: 'analyst-1', requestId: '00000000-0000-4000-8000-000000000102', action: 'DOCUMENT_DELETED', meta: { documentId: 'document-1', dealId: 'deal-1' } },
    })
    expect(JSON.stringify(mocks.auditCreate.mock.calls[0][0])).not.toContain('a.pdf')
  })
  it('does not delete R2, database, or audit for a foreign document', async () => {
    mocks.findDocument.mockResolvedValue({ id: 'foreign', tenantId: 'tenant-2', dealId: 'deal-2', r2Key: 'tenants/tenant-2/x' })
    const response = await DELETE(new Request('https://metis.example/api/documents/foreign', { method: 'DELETE' }) as NextRequest, { params: Promise.resolve({ id: 'foreign' }) })
    expect(response.status).toBe(404)
    expect(mocks.deleteObject).not.toHaveBeenCalled()
    expect(mocks.delete).not.toHaveBeenCalled()
    expect(mocks.auditCreate).not.toHaveBeenCalled()
  })
})
