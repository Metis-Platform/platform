import { db } from '@/lib/db'
import { EventStatus } from '@/app/generated/prisma'

/**
 * (Re-)generate the OPTION_EXPIRY event for a land deal.
 * Called on create and update. Idempotent: deletes any existing
 * OPTION_EXPIRY event for this deal and recreates it if optionExpiry is set.
 * Only touches OPTION_EXPIRY events — other events are never deleted.
 */
export async function generateLandEvents(dealId: string, tenantId: string): Promise<void> {
  const deal = await db.deal.findUnique({
    where: { id: dealId, tenantId },
    include: { land: true },
  })
  if (!deal?.land) return

  await db.event.deleteMany({ where: { dealId, eventType: 'OPTION_EXPIRY' } })

  if (deal.land.optionExpiry) {
    const now = new Date()
    const status: EventStatus = deal.land.optionExpiry < now ? EventStatus.OVERDUE : EventStatus.PENDING
    await db.event.create({
      data: {
        dealId,
        eventType: 'OPTION_EXPIRY',
        label: 'Option Expiry',
        dueDate: deal.land.optionExpiry,
        status,
      },
    })
  }
}
