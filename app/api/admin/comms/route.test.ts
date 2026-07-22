import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  isSuperAdmin: vi.fn(), auth: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), sendEmail: vi.fn(), emitAuditEvent: vi.fn(),
}))

vi.mock('@clerk/nextjs/server', () => ({ auth: mocks.auth }))
vi.mock('@/lib/admin-auth', () => ({ isSuperAdmin: mocks.isSuperAdmin }))
vi.mock('@/lib/db', () => ({
  db: {
    auditEvent: { findFirst: mocks.findFirst },
    tenant: { findMany: mocks.findMany, findUnique: mocks.findUnique },
  },
}))
vi.mock('@/lib/email', () => ({ sendEmail: mocks.sendEmail }))
vi.mock('@/lib/audit', () => ({ emitAuditEvent: mocks.emitAuditEvent }))

import { POST } from './route'

const privateSubject = 'Private investor acquisition: 123 Example Street'
const privateBody = 'Confidential owner and underwriting details.'

describe('admin communications audit metadata', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.isSuperAdmin.mockResolvedValue(true)
    mocks.auth.mockResolvedValue({ userId: 'admin-1' })
    mocks.findFirst.mockResolvedValue(null)
    mocks.sendEmail.mockResolvedValue('sent')
    mocks.emitAuditEvent.mockResolvedValue(undefined)
  })

  it('keeps broadcast delivery counts but excludes the submitted subject and body', async () => {
    mocks.findMany.mockResolvedValue([{ users: [{ email: 'owner@example.com' }] }])

    const response = await POST(new NextRequest('https://metis.example/api/admin/comms', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ broadcast: true, subject: privateSubject, body: privateBody }),
    }))

    expect(response.status).toBe(200)
    expect(mocks.emitAuditEvent).toHaveBeenCalledWith('system', 'ADMIN_EMAIL_SENT', {
      broadcast: true, sent: 1, sunk: 0, failed: 0,
    }, 'admin-1')
    expect(JSON.stringify(mocks.emitAuditEvent.mock.calls[0])).not.toContain(privateSubject)
    expect(JSON.stringify(mocks.emitAuditEvent.mock.calls[0])).not.toContain(privateBody)
  })

  it('keeps tenant delivery totals but excludes the submitted message content', async () => {
    mocks.findUnique.mockResolvedValue({ id: 'tenant-1', users: [{ email: 'owner@example.com' }, { email: 'member@example.com' }] })

    const response = await POST(new NextRequest('https://metis.example/api/admin/comms', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tenantId: 'tenant-1', subject: privateSubject, body: privateBody }),
    }))

    expect(response.status).toBe(200)
    expect(mocks.emitAuditEvent).toHaveBeenCalledWith('tenant-1', 'ADMIN_EMAIL_SENT', {
      recipients: 2, sunk: 0,
    }, 'admin-1')
    expect(JSON.stringify(mocks.emitAuditEvent.mock.calls[0])).not.toContain(privateSubject)
    expect(JSON.stringify(mocks.emitAuditEvent.mock.calls[0])).not.toContain(privateBody)
  })
})
