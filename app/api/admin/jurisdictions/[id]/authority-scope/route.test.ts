import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  isSuperAdmin: vi.fn(),
  currentUser: vi.fn(),
  sourceFindFirst: vi.fn(),
  publishJurisdictionClaim: vi.fn(),
}))

vi.mock('@/lib/admin-auth', () => ({ isSuperAdmin: mocks.isSuperAdmin }))
vi.mock('@clerk/nextjs/server', () => ({ currentUser: mocks.currentUser }))
vi.mock('@/lib/db', () => ({ db: { jurisdictionSourceUrl: { findFirst: mocks.sourceFindFirst } } }))
vi.mock('@/lib/jurisdiction-claim-publication', () => ({ publishJurisdictionClaim: mocks.publishJurisdictionClaim }))

import { POST } from './route'

const source = {
  id: 'source-1', url: 'https://planning.example.gov/authority', authorityClass: 'LOCAL_OFFICIAL',
  authorityOwner: 'Example County Planning', authorityStatus: 'VERIFIED',
  authorityVerifiedAt: new Date('2026-07-20T00:00:00.000Z'), authorityVerifiedBy: 'reviewer-1',
  evidenceSnapshots: [{
    id: 'snapshot-1', sourceUrl: 'https://planning.example.gov/authority', retrievedAt: new Date('2026-07-20T00:00:00.000Z'),
    contentHash: 'hash', storageKey: 'evidence/snapshot-1', retrievalAdapter: 'JINA_READER',
    representationMediaType: 'text/html', byteLength: 100,
  }],
}

describe('authority scope publication route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.isSuperAdmin.mockResolvedValue(true)
    mocks.currentUser.mockResolvedValue({ id: 'reviewer-1' })
    mocks.sourceFindFirst.mockResolvedValue(source)
    mocks.publishJurisdictionClaim.mockResolvedValue({ claimId: 'claim-1' })
  })

  it('requires a verified local source and immutable evidence snapshot', async () => {
    mocks.sourceFindFirst.mockResolvedValue(null)
    const response = await POST(new Request('https://metis.example/api/admin/jurisdictions/j-1/authority-scope', {
      method: 'POST', body: JSON.stringify({ sourceUrlId: 'source-1', scope: 'COUNTY_WIDE', citation: 'This statement establishes county-wide authority.' }),
    }), { params: Promise.resolve({ id: 'j-1' }) })
    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toEqual({ error: 'VERIFIED_LOCAL_SOURCE_REQUIRED' })
  })

  it('publishes an evidence-backed authority scope through the claim ledger', async () => {
    const response = await POST(new Request('https://metis.example/api/admin/jurisdictions/j-1/authority-scope', {
      method: 'POST', body: JSON.stringify({ sourceUrlId: 'source-1', scope: 'UNINCORPORATED_COUNTY', citation: 'This statement establishes unincorporated county planning authority.' }),
    }), { params: Promise.resolve({ id: 'j-1' }) })
    expect(response.status).toBe(201)
    expect(mocks.publishJurisdictionClaim).toHaveBeenCalledWith(expect.objectContaining({
      jurisdictionId: 'j-1', section: 'zoning', fieldKey: 'countyLandUseAuthorityScope',
      extractedValue: expect.objectContaining({ value: 'UNINCORPORATED_COUNTY', geographicScope: 'UNINCORPORATED_COUNTY' }),
      source: expect.objectContaining({ sourceUrlId: 'source-1', evidenceSnapshotId: 'snapshot-1' }),
    }))
  })
})
