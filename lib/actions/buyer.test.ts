import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  sync: vi.fn(),
  headers: vi.fn(),
  redirect: vi.fn(),
  revalidatePath: vi.fn(),
  findContact: vi.fn(),
  createContact: vi.fn(),
  createProfile: vi.fn(),
  updateContact: vi.fn(),
  upsertProfile: vi.fn(),
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
    $transaction: async (callback: (tx: unknown) => unknown) => callback({
      contact: { create: mocks.createContact, update: mocks.updateContact },
      buyerProfile: { create: mocks.createProfile, upsert: mocks.upsertProfile },
      auditEvent: { create: mocks.auditCreate },
    }),
  },
}))

import { createBuyer, updateBuyerProfile } from './buyer'

const form = () => {
  const value = new FormData()
  value.set('firstName', 'Avery')
  value.set('lastName', 'Buyer')
  value.set('email', 'avery@example.com')
  value.set('priceMin', '125000')
  value.set('preferredStates', 'fl, ga')
  value.set('profileNotes', 'Sensitive investment criteria')
  return value
}

describe('buyer actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ userId: 'clerk-1', orgId: 'org-1' })
    mocks.sync.mockResolvedValue({ tenant: { id: 'tenant-1' }, user: { id: 'analyst-1' } })
    mocks.headers.mockResolvedValue(new Headers({ 'x-request-id': '00000000-0000-4000-8000-000000000131' }))
    mocks.createContact.mockResolvedValue({ id: 'buyer-1' })
    mocks.findContact.mockResolvedValue({ id: 'buyer-1', tenantId: 'tenant-1' })
  })

  it('atomically records buyer creation without PII or investment preferences', async () => {
    await createBuyer({}, form())

    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-1', userId: 'analyst-1', requestId: '00000000-0000-4000-8000-000000000131',
        action: 'BUYER_PROFILE_CREATED', meta: { contactId: 'buyer-1' },
      },
    })
    const audit = JSON.stringify(mocks.auditCreate.mock.calls[0][0])
    expect(audit).not.toContain('avery@example.com')
    expect(audit).not.toContain('Sensitive investment criteria')
    expect(audit).not.toContain('125000')
  })

  it('atomically records buyer updates without PII or investment preferences', async () => {
    await updateBuyerProfile('buyer-1', {}, form())

    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-1', userId: 'analyst-1', requestId: '00000000-0000-4000-8000-000000000131',
        action: 'BUYER_PROFILE_UPDATED', meta: { contactId: 'buyer-1' },
      },
    })
    const audit = JSON.stringify(mocks.auditCreate.mock.calls[0][0])
    expect(audit).not.toContain('avery@example.com')
    expect(audit).not.toContain('Sensitive investment criteria')
    expect(audit).not.toContain('125000')
  })

  it('does not write a buyer or audit event for invalid create input', async () => {
    const invalid = new FormData()
    const result = await createBuyer({}, invalid)

    expect(result).toEqual({ error: 'Enter a name or company' })
    expect(mocks.createContact).not.toHaveBeenCalled()
    expect(mocks.auditCreate).not.toHaveBeenCalled()
  })

  it('does not update or audit a buyer outside the tenant', async () => {
    mocks.findContact.mockResolvedValue(null)

    const result = await updateBuyerProfile('foreign-buyer', {}, form())

    expect(result).toEqual({ error: 'Buyer not found' })
    expect(mocks.updateContact).not.toHaveBeenCalled()
    expect(mocks.auditCreate).not.toHaveBeenCalled()
  })
})
