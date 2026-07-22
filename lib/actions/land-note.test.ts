import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  hasStrategy: vi.fn(),
  headers: vi.fn(),
  findTenant: vi.fn(),
  findDeal: vi.fn(),
  findBuyer: vi.fn(),
  createNote: vi.fn(),
  auditCreate: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock('@clerk/nextjs/server', () => ({ auth: mocks.auth }))
vi.mock('@/lib/entitlements', () => ({ hasStrategy: mocks.hasStrategy }))
vi.mock('next/headers', () => ({ headers: mocks.headers }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('@/lib/db', () => ({
  db: {
    tenant: { findUnique: mocks.findTenant },
    deal: { findUnique: mocks.findDeal },
    contact: { findFirst: mocks.findBuyer },
    $transaction: async (callback: (tx: unknown) => unknown) => callback({
      landNote: { create: mocks.createNote },
      auditEvent: { create: mocks.auditCreate },
    }),
  },
}))

import { createLandNote } from './land-note'

const form = (buyerContactId = 'buyer-1') => {
  const value = new FormData()
  value.set('buyerContactId', buyerContactId)
  value.set('buyerName', 'Private Buyer')
  value.set('buyerEmail', 'buyer@example.com')
  value.set('principal', '50000')
  value.set('interestRate', '10')
  value.set('termMonths', '36')
  value.set('paymentAmount', '1600')
  value.set('firstPaymentDate', '2026-08-01')
  value.set('notes', 'Sensitive seller-finance terms')
  return value
}

describe('land note action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ userId: 'user-1', orgId: 'org-1' })
    mocks.hasStrategy.mockResolvedValue(true)
    mocks.headers.mockResolvedValue(new Headers({ 'x-request-id': '00000000-0000-4000-8000-000000000141' }))
    mocks.findTenant.mockResolvedValue({ id: 'tenant-1' })
    mocks.findDeal.mockResolvedValue({ id: 'deal-1', tenantId: 'tenant-1' })
    mocks.findBuyer.mockResolvedValue({ id: 'buyer-1' })
    mocks.createNote.mockResolvedValue({ id: 'note-1' })
  })

  it('atomically records land-note creation without buyer PII or note economics', async () => {
    const result = await createLandNote('deal-1', {}, form())

    expect(result).toEqual({})
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-1', userId: 'user-1', requestId: '00000000-0000-4000-8000-000000000141',
        action: 'LAND_NOTE_CREATED', meta: { dealId: 'deal-1', noteId: 'note-1' },
      },
    })
    const audit = JSON.stringify(mocks.auditCreate.mock.calls[0][0])
    expect(audit).not.toContain('buyer@example.com')
    expect(audit).not.toContain('Sensitive seller-finance terms')
    expect(audit).not.toContain('50000')
  })

  it('does not create or audit a note for a foreign buyer contact', async () => {
    mocks.findBuyer.mockResolvedValue(null)

    const result = await createLandNote('deal-1', {}, form('foreign-buyer'))

    expect(result).toEqual({ message: 'Buyer not found.' })
    expect(mocks.createNote).not.toHaveBeenCalled()
    expect(mocks.auditCreate).not.toHaveBeenCalled()
  })
})
