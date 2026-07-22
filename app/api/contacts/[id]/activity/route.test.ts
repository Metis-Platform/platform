import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ sync: vi.fn(), findContact: vi.fn(), create: vi.fn(), auditCreate: vi.fn() }))
vi.mock('@/lib/sync-user', () => ({ syncUserToDatabase: mocks.sync }))
vi.mock('@/lib/db', () => ({
  db: {
    contact: { findUnique: mocks.findContact },
    $transaction: async (callback: (tx: unknown) => unknown) => callback({
      contactActivity: { create: mocks.create }, auditEvent: { create: mocks.auditCreate },
    }),
  },
}))

import { POST } from './route'

describe('contact activity route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.sync.mockResolvedValue({ tenant: { id: 'tenant-1' }, user: { id: 'analyst-1' } })
    mocks.findContact.mockResolvedValue({ id: 'contact-1' })
    mocks.create.mockResolvedValue({ id: 'activity-1' })
  })

  it('atomically records a correlated activity create without communication content', async () => {
    const notes = 'Sensitive offer negotiation details'
    const response = await POST(new Request('https://metis.example/api/contacts/contact-1/activity', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-request-id': '00000000-0000-4000-8000-000000000091' },
      body: JSON.stringify({ type: 'OFFER_SENT', notes }),
    }), { params: Promise.resolve({ id: 'contact-1' }) })
    expect(response.status).toBe(201)
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-1', userId: 'analyst-1', requestId: '00000000-0000-4000-8000-000000000091',
        action: 'CONTACT_ACTIVITY_CREATED', meta: { contactId: 'contact-1', activityId: 'activity-1' },
      },
    })
    expect(JSON.stringify(mocks.auditCreate.mock.calls[0][0])).not.toContain(notes)
  })
})
