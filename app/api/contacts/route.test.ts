import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ sync: vi.fn(), create: vi.fn(), auditCreate: vi.fn() }))
vi.mock('@/lib/sync-user', () => ({ syncUserToDatabase: mocks.sync }))
vi.mock('@/lib/db', () => ({
  db: {
    $transaction: async (callback: (tx: unknown) => unknown) => callback({
      contact: { create: mocks.create }, auditEvent: { create: mocks.auditCreate },
    }),
  },
}))

import { POST } from './route'

describe('contacts route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.sync.mockResolvedValue({ tenant: { id: 'tenant-1' }, user: { id: 'analyst-1' } })
    mocks.create.mockResolvedValue({ id: 'contact-1' })
  })

  it('atomically records a correlated contact creation without PII', async () => {
    const email = 'private@example.com'
    const response = await POST(new Request('https://metis.example/api/contacts', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-request-id': '00000000-0000-4000-8000-000000000081' },
      body: JSON.stringify({ type: 'VENDOR', firstName: 'Private', lastName: 'Vendor', email, notes: 'Sensitive note' }),
    }))
    expect(response.status).toBe(201)
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-1', userId: 'analyst-1', requestId: '00000000-0000-4000-8000-000000000081',
        action: 'CONTACT_CREATED', meta: { contactId: 'contact-1' },
      },
    })
    expect(JSON.stringify(mocks.auditCreate.mock.calls[0][0])).not.toContain(email)
  })
})
