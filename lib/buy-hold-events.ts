import { db } from '@/lib/db'
import { EventType, EventStatus } from '@/app/generated/prisma'

export async function generateBuyHoldEvents(dealId: string): Promise<void> {
  const buyHold = await db.dealBuyHold.findUnique({ where: { dealId } })
  if (!buyHold) return

  await db.$transaction(async tx => {
    await tx.event.deleteMany({
      where: { dealId, eventType: { in: ['LEASE_EXPIRY', 'CLOSING_DUE'] } },
    })

    const toCreate: {
      dealId: string
      tenantId: string
      eventType: EventType
      label: string
      dueDate: Date
      status: EventStatus
    }[] = []

    const deal = await tx.deal.findUnique({ where: { id: dealId }, select: { tenantId: true } })
    if (!deal) return

    if (buyHold.leaseEndDate) {
      toCreate.push({
        dealId,
        tenantId: deal.tenantId,
        eventType: EventType.LEASE_EXPIRY,
        label:     'Lease Expiry',
        dueDate:   buyHold.leaseEndDate,
        status:    buyHold.leaseEndDate < new Date() ? EventStatus.OVERDUE : EventStatus.PENDING,
      })
    }

    if (toCreate.length > 0) {
      await tx.event.createMany({ data: toCreate })
    }
  })
}
