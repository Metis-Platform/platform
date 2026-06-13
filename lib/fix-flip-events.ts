import { db } from '@/lib/db'

export async function generateFixFlipEvents(dealId: string): Promise<void> {
  const fixFlip = await db.dealFixFlip.findUnique({ where: { dealId } })
  if (!fixFlip) return

  const now = new Date()

  await db.$transaction(async tx => {
    await tx.event.deleteMany({
      where: { dealId, eventType: { in: ['REHAB_DUE', 'LISTING_TARGET', 'CLOSING_DUE'] } },
    })

    const events: Parameters<typeof tx.event.create>[0]['data'][] = []

    if (fixFlip.rehabTargetCompletion) {
      events.push({
        dealId,
        eventType: 'REHAB_DUE',
        label: 'Rehab target completion',
        dueDate: fixFlip.rehabTargetCompletion,
        status: fixFlip.rehabTargetCompletion < now ? 'OVERDUE' : 'PENDING',
      })
    }

    if (fixFlip.listingDate) {
      events.push({
        dealId,
        eventType: 'LISTING_TARGET',
        label: 'Target listing date',
        dueDate: fixFlip.listingDate,
        status: fixFlip.listingDate < now ? 'OVERDUE' : 'PENDING',
      })
    }

    if (fixFlip.closingDate) {
      events.push({
        dealId,
        eventType: 'CLOSING_DUE',
        label: 'Closing date',
        dueDate: fixFlip.closingDate,
        status: fixFlip.closingDate < now ? 'OVERDUE' : 'PENDING',
      })
    }

    for (const data of events) {
      await tx.event.create({ data })
    }
  })
}
