import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  headers: vi.fn(),
}))

vi.mock('@/lib/db', () => ({ db: { auditEvent: { create: mocks.create } } }))
vi.mock('next/headers', () => ({ headers: mocks.headers }))

import { emitAuditEvent } from './audit'

describe('audit events', () => {
  beforeEach(() => vi.clearAllMocks())

  it('persists a valid request ID from a server action header', async () => {
    mocks.headers.mockResolvedValue(new Headers({
      'x-request-id': '018f1d6f-6a64-7a86-a882-0f3866642e33',
    }))

    await emitAuditEvent('tenant-1', 'DEAL_CREATED', { dealId: 'deal-1' }, 'user-1')

    expect(mocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        userId: 'user-1',
        requestId: '018f1d6f-6a64-7a86-a882-0f3866642e33',
        action: 'DEAL_CREATED',
      }),
    })
  })

  it('does not persist an invalid request ID', async () => {
    mocks.headers.mockResolvedValue(new Headers({ 'x-request-id': 'not-a-uuid' }))

    await emitAuditEvent('tenant-1', 'DEAL_CREATED')

    expect(mocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ requestId: undefined }),
    })
  })
})
