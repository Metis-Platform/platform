import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  syncUserToDatabase: vi.fn(),
  findUnique: vi.fn(),
  workUpsert: vi.fn(),
  demandUpsert: vi.fn(),
  createMany: vi.fn(),
  transaction: vi.fn(),
}))

vi.mock('@/lib/sync-user', () => ({ syncUserToDatabase: mocks.syncUserToDatabase }))
vi.mock('@/lib/db', () => ({
  db: {
    jurisdiction: { findUnique: mocks.findUnique },
    $transaction: mocks.transaction,
  },
}))

import { POST } from './route'

describe('jurisdiction research request', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.syncUserToDatabase.mockResolvedValue({ tenant: { id: 'tenant-1' }, user: { id: 'user-1' } })
    mocks.workUpsert.mockResolvedValue({ id: 'work-1', status: 'DISCOVERING', requestedAt: new Date('2026-07-14T00:00:00Z') })
    mocks.demandUpsert.mockResolvedValue({ id: 'demand-1', requestedAt: new Date('2026-07-14T00:00:00Z') })
    mocks.createMany.mockImplementation(async ({ data }) => ({ count: data ? 1 : 0 }))
    mocks.transaction.mockImplementation(async callback => callback({
      jurisdictionResearchWork: { upsert: mocks.workUpsert },
      jurisdictionResearchDemand: { upsert: mocks.demandUpsert },
      jurisdictionSourceDiscoveryLead: { createMany: mocks.createMany },
    }))
  })

  it('queues exact Volusia county-office candidates as non-authoritative discovery leads', async () => {
    mocks.findUnique.mockResolvedValue({ id: 'jurisdiction-1', state: 'FL', county: 'Volusia' })

    const response = await POST(new Request('https://metis.example'), { params: Promise.resolve({ id: 'jurisdiction-1' }) })
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.discovery).toEqual({ status: 'DISCOVERED', leads: 6, created: 6 })
    expect(mocks.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ candidateScope: 'COUNTY_OFFICE_CANDIDATE' }),
      skipDuplicates: true,
    }))
  })

  it('records demand but reports discovery needed when no adapter exists', async () => {
    mocks.findUnique.mockResolvedValue({ id: 'jurisdiction-1', state: 'TX', county: 'Travis' })

    const response = await POST(new Request('https://metis.example'), { params: Promise.resolve({ id: 'jurisdiction-1' }) })
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.discovery).toEqual({ status: 'DISCOVERY_NEEDED', leads: 0, created: 0 })
    expect(mocks.createMany).not.toHaveBeenCalled()
  })
})
