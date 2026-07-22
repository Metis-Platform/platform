import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ sync: vi.fn(), findFirst: vi.fn(), update: vi.fn(), delete: vi.fn(), auditCreate: vi.fn() }))
vi.mock('@/lib/sync-user', () => ({ syncUserToDatabase: mocks.sync }))
vi.mock('@/lib/db', () => ({
  db: {
    $transaction: async (callback: (tx: unknown) => unknown) => callback({
      contact: { findFirst: mocks.findFirst, update: mocks.update, delete: mocks.delete }, auditEvent: { create: mocks.auditCreate },
    }),
  },
}))

import { DELETE, PUT } from './route'

describe('contact lifecycle route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.sync.mockResolvedValue({ tenant: { id: 'tenant-1' }, user: { id: 'analyst-1' } })
    mocks.findFirst.mockResolvedValue({ id: 'contact-1' })
    mocks.update.mockResolvedValue({ id: 'contact-1' })
  })

  it('atomically records an update without contact fields', async () => {
    const response = await PUT(new Request('https://metis.example/api/contacts/contact-1', {
      method: 'PUT', headers: { 'content-type': 'application/json', 'x-request-id': '00000000-0000-4000-8000-000000000082' },
      body: JSON.stringify({ email: 'revised-private@example.com', notes: 'Sensitive revised note' }),
    }), { params: Promise.resolve({ id: 'contact-1' }) })
    expect(response.status).toBe(200)
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-1', userId: 'analyst-1', requestId: '00000000-0000-4000-8000-000000000082',
        action: 'CONTACT_UPDATED', meta: { contactId: 'contact-1' },
      },
    })
    expect(JSON.stringify(mocks.auditCreate.mock.calls[0][0])).not.toContain('revised-private@example.com')
  })

  it('records a correlated delete only for the tenant contact', async () => {
    const response = await DELETE(new Request('https://metis.example/api/contacts/contact-1', {
      method: 'DELETE', headers: { 'x-request-id': '00000000-0000-4000-8000-000000000083' },
    }), { params: Promise.resolve({ id: 'contact-1' }) })
    expect(response.status).toBe(200)
    expect(mocks.delete).toHaveBeenCalledWith({ where: { id: 'contact-1' } })
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-1', userId: 'analyst-1', requestId: '00000000-0000-4000-8000-000000000083',
        action: 'CONTACT_DELETED', meta: { contactId: 'contact-1' },
      },
    })
  })

  it('does not mutate or audit a contact absent from the tenant', async () => {
    mocks.findFirst.mockResolvedValue(null)
    const response = await DELETE(new Request('https://metis.example/api/contacts/foreign', { method: 'DELETE' }), { params: Promise.resolve({ id: 'foreign' }) })
    expect(response.status).toBe(404)
    expect(mocks.delete).not.toHaveBeenCalled()
    expect(mocks.auditCreate).not.toHaveBeenCalled()
  })
})
