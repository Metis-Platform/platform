import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({ auth: vi.fn(), sync: vi.fn(), findDeal: vi.fn(), getUploadUrl: vi.fn() }))
vi.mock('@clerk/nextjs/server', () => ({ auth: mocks.auth }))
vi.mock('@/lib/sync-user', () => ({ syncUserToDatabase: mocks.sync }))
vi.mock('@/lib/db', () => ({ db: { deal: { findFirst: mocks.findDeal } } }))
vi.mock('@/lib/r2', () => ({ getUploadUrl: mocks.getUploadUrl }))

import { POST } from './route'

describe('document presign route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ userId: 'clerk-1', orgId: 'org-1' })
    mocks.sync.mockResolvedValue({ tenant: { id: 'tenant-1' }, user: { id: 'analyst-1' } })
    mocks.findDeal.mockResolvedValue({ id: 'deal-1' })
    mocks.getUploadUrl.mockResolvedValue('https://r2.example/upload')
  })
  const request = (dealId: string) => new Request('https://metis.example/api/documents/presign', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ dealId, fileName: 'private.pdf', fileSize: 100, mimeType: 'application/pdf', docType: 'OTHER' }),
  }) as NextRequest

  it('issues an upload capability only for a tenant-owned deal', async () => {
    const response = await POST(request('deal-1'))
    expect(response.status).toBe(200)
    expect(mocks.getUploadUrl).toHaveBeenCalled()
  })
  it('does not issue an upload capability for a foreign deal', async () => {
    mocks.findDeal.mockResolvedValue(null)
    const response = await POST(request('foreign-deal'))
    expect(response.status).toBe(404)
    expect(mocks.getUploadUrl).not.toHaveBeenCalled()
  })
})
