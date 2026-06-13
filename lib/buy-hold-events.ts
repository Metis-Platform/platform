import { db } from '@/lib/db'
import { EventType, EventStatus } from '@/app/generated/prisma'

export async function generateBuyHoldEvents(dealId: string): Promise<void> {
  const buyHold = await db.dealBuyHold.findUnique({ where: { dealId } })
  if (!buyHold) return

  await db.$transaction(async tx => {
    await tx.event.deleteMany({
      where: { dealId, eventType: { in: ['LEASE_EXPIRY', 'HQS_INSPECTION', 'RENT_INCREASE_WINDOW'] } },
    })

    const deal = await tx.deal.findUnique({ where: { id: dealId }, select: { tenantId: true } })
    if (!deal) return

    const now = new Date()
    const toCreate: {
      dealId: string
      tenantId: string
      eventType: EventType
      label: string
      dueDate: Date
      status: EventStatus
    }[] = []

    // Lease expiry event
    if (buyHold.leaseEndDate) {
      toCreate.push({
        dealId, tenantId: deal.tenantId,
        eventType: EventType.LEASE_EXPIRY,
        label: 'Lease Expiry',
        dueDate: buyHold.leaseEndDate,
        status: buyHold.leaseEndDate < now ? EventStatus.OVERDUE : EventStatus.PENDING,
      })
    }

    // HQS inspection event (at 2-week warning + on the date)
    if (buyHold.nextHqsDate) {
      const hqs = buyHold.nextHqsDate
      const twoWeeksBefore = new Date(hqs)
      twoWeeksBefore.setDate(twoWeeksBefore.getDate() - 14)
      if (twoWeeksBefore > now) {
        toCreate.push({
          dealId, tenantId: deal.tenantId,
          eventType: EventType.HQS_INSPECTION,
          label: 'HQS Inspection Prep (2 weeks)',
          dueDate: twoWeeksBefore,
          status: EventStatus.PENDING,
        })
      }
      toCreate.push({
        dealId, tenantId: deal.tenantId,
        eventType: EventType.HQS_INSPECTION,
        label: 'HQS Inspection',
        dueDate: hqs,
        status: hqs < now ? EventStatus.OVERDUE : EventStatus.PENDING,
      })
    }

    // Rent increase window event (notice days before HAP anniversary)
    if (buyHold.hapAnniversary) {
      const noticeDays = (buyHold.rentIncreaseNoticeDays ?? 60)
      const anniversary = buyHold.hapAnniversary
      const windowStart = new Date(anniversary)
      windowStart.setDate(windowStart.getDate() - noticeDays)
      if (windowStart > now) {
        toCreate.push({
          dealId, tenantId: deal.tenantId,
          eventType: EventType.RENT_INCREASE_WINDOW,
          label: `Rent Increase Window Opens (${noticeDays} days notice)`,
          dueDate: windowStart,
          status: EventStatus.PENDING,
        })
      }
    }

    if (toCreate.length > 0) {
      await tx.event.createMany({ data: toCreate })
    }
  })
}
