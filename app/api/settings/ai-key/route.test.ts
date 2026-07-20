import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  update: vi.fn(),
  auditCreate: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ getCurrentUser: mocks.getCurrentUser, hasRole: (role: string) => role === 'OWNER' }))
vi.mock('@/lib/db', () => ({
  db: {
    $transaction: async (callback: (tx: unknown) => unknown) => callback({
      tenant: { update: mocks.update }, auditEvent: { create: mocks.auditCreate },
    }),
  },
}))

import { PATCH } from './route'

describe('AI key settings route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCurrentUser.mockResolvedValue({
      tenant: { id: 'tenant-1' }, user: { id: 'owner-1', role: 'OWNER' },
    })
  })

  it('atomically records key configuration without retaining the credential', async () => {
    const secret = 'sk-ant-private-test-key'
    const response = await PATCH(new Request('https://metis.example/api/settings/ai-key', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'x-request-id': '00000000-0000-4000-8000-000000000021' },
      body: JSON.stringify({ apiKey: secret }),
    }))

    expect(response.status).toBe(200)
    expect(mocks.update).toHaveBeenCalledWith({ where: { id: 'tenant-1' }, data: { anthropicApiKey: secret } })
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-1', userId: 'owner-1', requestId: '00000000-0000-4000-8000-000000000021',
        action: 'AI_KEY_CONFIGURATION_CHANGED', meta: { configured: true },
      },
    })
    expect(JSON.stringify(mocks.auditCreate.mock.calls[0][0])).not.toContain(secret)
  })

  it('records removal without a credential value', async () => {
    const response = await PATCH(new Request('https://metis.example/api/settings/ai-key', {
      method: 'PATCH', body: JSON.stringify({ apiKey: null }),
    }))

    expect(response.status).toBe(200)
    expect(mocks.auditCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'AI_KEY_CONFIGURATION_CHANGED', meta: { configured: false } }),
    }))
  })

  it('refuses a non-owner before changing the key or writing an audit event', async () => {
    mocks.getCurrentUser.mockResolvedValue({
      tenant: { id: 'tenant-1' }, user: { id: 'member-1', role: 'ANALYST' },
    })
    const response = await PATCH(new Request('https://metis.example/api/settings/ai-key', {
      method: 'PATCH', body: JSON.stringify({ apiKey: 'sk-ant-private-test-key' }),
    }))

    expect(response.status).toBe(403)
    expect(mocks.update).not.toHaveBeenCalled()
    expect(mocks.auditCreate).not.toHaveBeenCalled()
  })
})
