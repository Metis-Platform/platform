import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), tenant: vi.fn(), hasStrategy: vi.fn(), headers: vi.fn(), findDeal: vi.fn(), findNote: vi.fn(),
  updateLand: vi.fn(), updateDeal: vi.fn(), updateNote: vi.fn(), auditCreate: vi.fn(), revalidatePath: vi.fn(),
}))

vi.mock('@clerk/nextjs/server', () => ({ auth: mocks.auth }))
vi.mock('next/headers', () => ({ headers: mocks.headers }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('@/lib/entitlements', () => ({ hasStrategy: mocks.hasStrategy }))
vi.mock('@/lib/db', () => ({
  db: {
    tenant: { findUnique: mocks.tenant },
    deal: { findUnique: mocks.findDeal },
    landNote: { findFirst: mocks.findNote },
    $transaction: async (callback: (tx: unknown) => unknown) => callback({
      dealLand: { update: mocks.updateLand }, deal: { update: mocks.updateDeal }, landNote: { update: mocks.updateNote }, auditEvent: { create: mocks.auditCreate },
    }),
  },
}))

import { defaultLandNote, updateLandDisposition } from './land-disposition'

const dispositionForm = () => {
  const form = new FormData()
  form.set('targetStatus', 'SOLD_CASH')
  form.set('listedPrice', '125000')
  return form
}

describe('land disposition actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ userId: 'user-1', orgId: 'org-1' })
    mocks.tenant.mockResolvedValue({ id: 'tenant-1' })
    mocks.hasStrategy.mockResolvedValue(true)
    mocks.headers.mockResolvedValue(new Headers({ 'x-request-id': '00000000-0000-4000-8000-000000000519' }))
    mocks.findDeal.mockResolvedValue({ id: 'deal-1', status: 'ACTIVE' })
    mocks.findNote.mockResolvedValue({ id: 'note-1', dealId: 'deal-1', tenantId: 'tenant-1', status: 'ACTIVE' })
  })

  it('atomically traces a disposition update without list price metadata', async () => {
    await updateLandDisposition('deal-1', {}, dispositionForm())

    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: { tenantId: 'tenant-1', userId: 'user-1', requestId: '00000000-0000-4000-8000-000000000519', action: 'LAND_DISPOSITION_UPDATED', meta: { dealId: 'deal-1' } },
    })
    expect(JSON.stringify(mocks.auditCreate.mock.calls[0][0])).not.toContain('125000')
  })

  it('defaults only a note belonging to the supplied tenant-owned deal and traces opaque identity', async () => {
    await defaultLandNote('deal-1', 'note-1', {}, new FormData())

    expect(mocks.updateNote).toHaveBeenCalledWith({ where: { id: 'note-1' }, data: { status: 'DEFAULTED' } })
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: { tenantId: 'tenant-1', userId: 'user-1', requestId: '00000000-0000-4000-8000-000000000519', action: 'LAND_NOTE_DEFAULTED', meta: { dealId: 'deal-1', noteId: 'note-1' } },
    })
  })

  it('does not default or audit a note outside the supplied deal', async () => {
    mocks.findNote.mockResolvedValue(null)

    expect(await defaultLandNote('deal-1', 'foreign-note', {}, new FormData())).toEqual({ message: 'Note not found.' })
    expect(mocks.updateNote).not.toHaveBeenCalled()
    expect(mocks.auditCreate).not.toHaveBeenCalled()
  })
})
