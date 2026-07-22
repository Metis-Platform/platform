import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  sync: vi.fn(),
  headers: vi.fn(),
  redirect: vi.fn(),
  revalidatePath: vi.fn(),
  findContact: vi.fn(),
  findActivity: vi.fn(),
  createContact: vi.fn(),
  updateContact: vi.fn(),
  deleteContact: vi.fn(),
  createActivity: vi.fn(),
  deleteActivity: vi.fn(),
  auditCreate: vi.fn(),
}))

vi.mock('@clerk/nextjs/server', () => ({ auth: mocks.auth }))
vi.mock('@/lib/sync-user', () => ({ syncUserToDatabase: mocks.sync }))
vi.mock('next/headers', () => ({ headers: mocks.headers }))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('@/lib/db', () => ({
  db: {
    contact: { findUnique: mocks.findContact },
    contactActivity: { findUnique: mocks.findActivity },
    $transaction: async (callback: (tx: unknown) => unknown) => callback({
      contact: { create: mocks.createContact, update: mocks.updateContact, delete: mocks.deleteContact },
      contactActivity: { create: mocks.createActivity, delete: mocks.deleteActivity },
      auditEvent: { create: mocks.auditCreate },
    }),
  },
}))

import { createContact, deleteActivity, deleteContact, logActivity, updateContact } from './contact'

const contactForm = () => {
  const form = new FormData()
  form.set('firstName', 'Avery')
  form.set('lastName', 'Investor')
  form.set('email', 'avery@example.com')
  form.set('notes', 'Sensitive contact note')
  return form
}

describe('contact actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ userId: 'clerk-1', orgId: 'org-1' })
    mocks.sync.mockResolvedValue({ tenant: { id: 'tenant-1' }, user: { id: 'analyst-1' } })
    mocks.headers.mockResolvedValue(new Headers({ 'x-request-id': '00000000-0000-4000-8000-000000000470' }))
    mocks.createContact.mockResolvedValue({ id: 'contact-1' })
    mocks.findContact.mockResolvedValue({ id: 'contact-1', tenantId: 'tenant-1' })
    mocks.findActivity.mockResolvedValue({ id: 'activity-1', contactId: 'contact-1', tenantId: 'tenant-1' })
    mocks.createActivity.mockResolvedValue({ id: 'activity-1' })
  })

  it('atomically records contact creation without PII or notes', async () => {
    await createContact({}, contactForm())

    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-1', userId: 'analyst-1', requestId: '00000000-0000-4000-8000-000000000470',
        action: 'CONTACT_CREATED', meta: { contactId: 'contact-1' },
      },
    })
    const audit = JSON.stringify(mocks.auditCreate.mock.calls[0][0])
    expect(audit).not.toContain('avery@example.com')
    expect(audit).not.toContain('Sensitive contact note')
  })

  it('records opaque correlated contact update and deletion evidence', async () => {
    await updateContact('contact-1', {}, contactForm())
    await deleteContact('contact-1', {}, new FormData())

    expect(mocks.auditCreate).toHaveBeenNthCalledWith(1, {
      data: {
        tenantId: 'tenant-1', userId: 'analyst-1', requestId: '00000000-0000-4000-8000-000000000470',
        action: 'CONTACT_UPDATED', meta: { contactId: 'contact-1' },
      },
    })
    expect(mocks.auditCreate).toHaveBeenNthCalledWith(2, {
      data: {
        tenantId: 'tenant-1', userId: 'analyst-1', requestId: '00000000-0000-4000-8000-000000000470',
        action: 'CONTACT_DELETED', meta: { contactId: 'contact-1' },
      },
    })
  })

  it('records opaque correlated contact activity create and deletion evidence', async () => {
    const activityForm = new FormData()
    activityForm.set('type', 'NOTE')
    activityForm.set('notes', 'Sensitive activity note')
    await logActivity('contact-1', {}, activityForm)
    await deleteActivity('contact-1', 'activity-1', {}, new FormData())

    expect(mocks.auditCreate).toHaveBeenNthCalledWith(1, {
      data: {
        tenantId: 'tenant-1', userId: 'analyst-1', requestId: '00000000-0000-4000-8000-000000000470',
        action: 'CONTACT_ACTIVITY_CREATED', meta: { contactId: 'contact-1', activityId: 'activity-1' },
      },
    })
    expect(mocks.auditCreate).toHaveBeenNthCalledWith(2, {
      data: {
        tenantId: 'tenant-1', userId: 'analyst-1', requestId: '00000000-0000-4000-8000-000000000470',
        action: 'CONTACT_ACTIVITY_DELETED', meta: { contactId: 'contact-1', activityId: 'activity-1' },
      },
    })
    const audit = JSON.stringify(mocks.auditCreate.mock.calls[0][0])
    expect(audit).not.toContain('Sensitive activity note')
  })

  it('does not mutate or audit a contact or activity outside the tenant', async () => {
    mocks.findContact.mockResolvedValue(null)
    const update = await updateContact('foreign-contact', {}, contactForm())
    mocks.findActivity.mockResolvedValue(null)
    const removeActivity = await deleteActivity('contact-1', 'foreign-activity', {}, new FormData())

    expect(update).toEqual({ error: 'Contact not found' })
    expect(removeActivity).toEqual({ error: 'Activity not found' })
    expect(mocks.updateContact).not.toHaveBeenCalled()
    expect(mocks.deleteActivity).not.toHaveBeenCalled()
    expect(mocks.auditCreate).not.toHaveBeenCalled()
  })
})
