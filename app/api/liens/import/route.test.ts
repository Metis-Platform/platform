import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  syncUserToDatabase: vi.fn(),
  db: {
    auditEvent: { create: vi.fn() },
    jurisdiction: { findMany: vi.fn() },
  },
}))

vi.mock('@clerk/nextjs/server', () => ({ auth: mocks.auth }))
vi.mock('@/lib/sync-user', () => ({ syncUserToDatabase: mocks.syncUserToDatabase }))
vi.mock('@/lib/db', () => ({ db: mocks.db }))
vi.mock('@/lib/rules-engine', () => ({ generateEventsForDeal: vi.fn() }))

import { POST } from './route'

describe('lien import route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ userId: 'user-1', orgId: 'org-1' })
    mocks.syncUserToDatabase.mockResolvedValue({ tenant: { id: 'tenant-1' }, user: { id: 'user-1' } })
  })

  it('rejects an oversized declared upload before multipart parsing', async () => {
    const formData = vi.fn(() => { throw new Error('formData must not run') })
    const request = {
      url: 'https://metis.example/api/liens/import',
      headers: new Headers({ 'content-length': '1064001' }),
      formData,
    } as unknown as NextRequest

    const response = await POST(request)

    expect(response.status).toBe(413)
    expect(formData).not.toHaveBeenCalled()
  })

  it('records tenant-safe preview evidence with the request correlation ID', async () => {
    mocks.db.jurisdiction.findMany.mockResolvedValue([{ id: 'jurisdiction-1', state: 'FL', county: 'Volusia' }])
    const form = new FormData()
    form.append('file', new Blob(['state,county,apn\nFL,Volusia,123'], { type: 'text/csv' }), 'liens.csv')
    const request = {
      url: 'https://metis.example/api/liens/import?preview=true',
      headers: new Headers({ 'x-request-id': '018f1d6f-6a64-7a86-a882-0f3866642e33' }),
      formData: vi.fn().mockResolvedValue(form),
    } as unknown as NextRequest

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(mocks.db.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        userId: 'user-1',
        requestId: '018f1d6f-6a64-7a86-a882-0f3866642e33',
        action: 'LIEN_IMPORT_REQUEST',
        meta: { mode: 'preview', totalRows: 1, validRows: 1 },
      }),
    })
  })
})
