import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  isSuperAdmin: vi.fn(),
  currentUser: vi.fn(),
  publishUnincorporatedAuthorityBoundary: vi.fn(),
}))

vi.mock('@/lib/admin-auth', () => ({ isSuperAdmin: mocks.isSuperAdmin }))
vi.mock('@clerk/nextjs/server', () => ({ currentUser: mocks.currentUser }))
vi.mock('@/lib/jurisdiction-authority-boundary', () => ({
  publishUnincorporatedAuthorityBoundary: mocks.publishUnincorporatedAuthorityBoundary,
}))

import { POST } from './route'

const geometry = {
  type: 'Polygon',
  coordinates: [[[-81.4, 28.8], [-81.2, 28.8], [-81.2, 29], [-81.4, 28.8]]],
}

describe('authority-boundary publication route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.isSuperAdmin.mockResolvedValue(true)
    mocks.currentUser.mockResolvedValue({ id: 'reviewer-1' })
    mocks.publishUnincorporatedAuthorityBoundary.mockResolvedValue({
      boundaryId: '00000000-0000-4000-8000-000000000001',
      claimId: '00000000-0000-4000-8000-000000000002',
    })
  })

  it('requires a super-admin and a reviewed polygon payload', async () => {
    mocks.isSuperAdmin.mockResolvedValue(false)
    const forbidden = await POST(new Request('https://metis.example/api/admin/jurisdictions/j-1/authority-boundaries', {
      method: 'POST', body: JSON.stringify({}),
    }), { params: Promise.resolve({ id: 'j-1' }) })
    expect(forbidden.status).toBe(403)

    mocks.isSuperAdmin.mockResolvedValue(true)
    const invalid = await POST(new Request('https://metis.example/api/admin/jurisdictions/j-1/authority-boundaries', {
      method: 'POST', body: JSON.stringify({ claimId: 'not-a-uuid', geometry: { type: 'Point' } }),
    }), { params: Promise.resolve({ id: 'j-1' }) })
    expect(invalid.status).toBe(400)
    expect(mocks.publishUnincorporatedAuthorityBoundary).not.toHaveBeenCalled()
  })

  it('passes an authenticated reviewed geometry to the authority-boundary publisher', async () => {
    const claimId = '00000000-0000-4000-8000-000000000002'
    const response = await POST(new Request('https://metis.example/api/admin/jurisdictions/j-1/authority-boundaries', {
      method: 'POST', body: JSON.stringify({ claimId, geometry }),
    }), { params: Promise.resolve({ id: 'j-1' }) })

    expect(response.status).toBe(201)
    expect(mocks.publishUnincorporatedAuthorityBoundary).toHaveBeenCalledWith({
      jurisdictionId: 'j-1', claimId, geometry, reviewerId: 'reviewer-1',
    })
  })
})
