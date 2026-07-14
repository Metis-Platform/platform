import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  notificationUpdate: vi.fn(),
  demandUpdate: vi.fn(),
  sendEmail: vi.fn(),
}))

vi.mock('./db', () => ({
  db: {
    jurisdictionCoverageNotification: {
      findMany: mocks.findMany,
      updateMany: mocks.notificationUpdate,
    },
    jurisdictionResearchDemand: { updateMany: mocks.demandUpdate },
  },
}))
vi.mock('./email', () => ({ sendEmail: mocks.sendEmail }))

import { deliverPendingCoverageNotifications } from './jurisdiction-coverage-notification-delivery'

const notification = {
  id: 'notification-1', demandId: 'demand-1', tenantId: 'tenant-1', jurisdictionId: 'jurisdiction-1',
  recipientEmail: 'investor@example.test', jurisdiction: { county: 'Volusia', state: 'FL' },
}

describe('coverage notification delivery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.findMany.mockResolvedValue([notification])
    mocks.notificationUpdate.mockResolvedValue({ count: 1 })
    mocks.demandUpdate.mockResolvedValue({ count: 1 })
  })

  it('sends a claimed notification with a stable provider idempotency key', async () => {
    mocks.sendEmail.mockResolvedValue('sent')

    await expect(deliverPendingCoverageNotifications()).resolves.toEqual({ sent: 1, sunk: 0, skipped: 0, failed: 0 })
    expect(mocks.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: notification.recipientEmail,
      idempotencyKey: 'jurisdiction-coverage-notification-1',
    }))
    expect(mocks.notificationUpdate).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'SENT' }),
    }))
    expect(mocks.demandUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenantId: 'tenant-1' }),
    }))
  })

  it('leaves a failed delivery pending for a later idempotent retry', async () => {
    mocks.sendEmail.mockRejectedValue(new Error('provider unavailable'))

    await expect(deliverPendingCoverageNotifications()).resolves.toEqual({ sent: 0, sunk: 0, skipped: 0, failed: 1 })
    expect(mocks.notificationUpdate).toHaveBeenLastCalledWith(expect.objectContaining({
      data: { failureCode: 'DELIVERY_FAILED' },
    }))
    expect(mocks.demandUpdate).not.toHaveBeenCalled()
  })
})
