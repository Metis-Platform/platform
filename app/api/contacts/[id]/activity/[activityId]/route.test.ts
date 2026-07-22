import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ sync: vi.fn(), findFirst: vi.fn(), delete: vi.fn(), auditCreate: vi.fn() }))
vi.mock('@/lib/sync-user', () => ({ syncUserToDatabase: mocks.sync }))
vi.mock('@/lib/db', () => ({
  db: {
    $transaction: async (callback: (tx: unknown) => unknown) => callback({
      contactActivity: { findFirst: mocks.findFirst, delete: mocks.delete }, auditEvent: { create: mocks.auditCreate },
    }),
  },
}))

import { DELETE } from './route'

describe('contact activity deletion route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.sync.mockResolvedValue({ tenant: { id: 'tenant-1' }, user: { id: 'analyst-1' } })
    mocks.findFirst.mockResolvedValue({ id: 'activity-1' })
  })

  it('records a correlated deletion only after finding the activity in the tenant contact', async () => {
    const response = await DELETE(new Request('https://metis.example/api/contacts/contact-1/activity/activity-1', {
      method: 'DELETE', headers: { 'x-request-id': '00000000-0000-4000-8000-000000000092' },
    }), { params: Promise.resolve({ id: 'contact-1', activityId: 'activity-1' }) })
    expect(response.status).toBe(200)
    expect(mocks.delete).toHaveBeenCalledWith({ where: { id: 'activity-1' } })
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-1', userId: 'analyst-1', requestId: '00000000-0000-4000-8000-000000000092',
        action: 'CONTACT_ACTIVITY_DELETED', meta: { contactId: 'contact-1', activityId: 'activity-1' },
      },
    })
  })

  it('does not delete or audit an activity outside the tenant contact', async () => {
    mocks.findFirst.mockResolvedValue(null)
    const response = await DELETE(new Request('https://metis.example/api/contacts/contact-1/activity/foreign', { method: 'DELETE' }), { params: Promise.resolve({ id: 'contact-1', activityId: 'foreign' }) })
    expect(response.status).toBe(404)
    expect(mocks.delete).not.toHaveBeenCalled()
    expect(mocks.auditCreate).not.toHaveBeenCalled()
  })
})
