import { db } from '@/lib/db'

export async function generateWholesaleEvents(dealId: string, tenantId: string): Promise<void> {
  const wholesale = await db.dealWholesale.findUnique({ where: { dealId } })
  if (!wholesale) return

  const now = new Date()

  await db.$transaction(async (tx) => {
    await tx.event.deleteMany({
      where: { dealId, eventType: { in: ['INSPECTION_END', 'CLOSING_DUE'] } },
    })

    if (wholesale.inspectionDeadline) {
      await tx.event.create({
        data: {
          dealId,
          eventType: 'INSPECTION_END',
          label: 'Inspection deadline',
          dueDate: wholesale.inspectionDeadline,
          status: wholesale.inspectionDeadline < now ? 'OVERDUE' : 'PENDING',
        },
      })
    }

    if (wholesale.closingDeadline) {
      await tx.event.create({
        data: {
          dealId,
          eventType: 'CLOSING_DUE',
          label: 'Closing deadline',
          dueDate: wholesale.closingDeadline,
          status: wholesale.closingDeadline < now ? 'OVERDUE' : 'PENDING',
        },
      })
    }
  })
}
