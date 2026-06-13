import { db } from '@/lib/db'
import { EventType, EventStatus } from '@/app/generated/prisma'

export async function generateMultifamilyEvents(dealId: string): Promise<void> {
  const mf = await db.dealMultifamily.findUnique({ where: { dealId } })
  if (!mf) return

  await db.$transaction(async tx => {
    await tx.event.deleteMany({
      where: { dealId, eventType: 'LOAN_MATURITY' },
    })

    const deal = await tx.deal.findUnique({ where: { id: dealId }, select: { tenantId: true } })
    if (!deal) return

    if (!mf.loanMaturityDate) return

    const maturity = mf.loanMaturityDate
    const now = new Date()

    const toCreate: {
      dealId: string
      tenantId: string
      eventType: EventType
      label: string
      dueDate: Date
      status: EventStatus
    }[] = []

    // Loan maturity warning events at 12, 6, and 3 months out
    const offsets = [
      { months: 12, label: 'Loan Maturity (12 mo)' },
      { months: 6,  label: 'Loan Maturity (6 mo)' },
      { months: 3,  label: 'Loan Maturity (3 mo)' },
    ]

    for (const { months, label } of offsets) {
      const dueDate = new Date(maturity)
      dueDate.setMonth(dueDate.getMonth() - months)
      if (dueDate > now) {
        toCreate.push({
          dealId,
          tenantId: deal.tenantId,
          eventType: EventType.LOAN_MATURITY,
          label,
          dueDate,
          status: EventStatus.PENDING,
        })
      }
    }

    // The maturity date itself
    toCreate.push({
      dealId,
      tenantId: deal.tenantId,
      eventType: EventType.LOAN_MATURITY,
      label: 'Loan Maturity',
      dueDate: maturity,
      status: maturity < now ? EventStatus.OVERDUE : EventStatus.PENDING,
    })

    if (toCreate.length > 0) {
      await tx.event.createMany({ data: toCreate })
    }
  })
}
