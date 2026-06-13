import { db } from '@/lib/db'
import { EventType, EventStatus } from '@/app/generated/prisma'
import { RentRollSchema, type RentRollUnit } from '@/lib/multifamily-schemas'

export async function generateMultifamilyEvents(dealId: string): Promise<void> {
  const mf = await db.dealMultifamily.findUnique({ where: { dealId } })
  if (!mf) return

  await db.$transaction(async tx => {
    await tx.event.deleteMany({
      where: { dealId, eventType: { in: ['LOAN_MATURITY', 'UNIT_LEASE_END'] } },
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

    // Loan maturity events at 12/6/3 months out + on the date
    if (mf.loanMaturityDate) {
      const maturity = mf.loanMaturityDate

      for (const { months, label } of [
        { months: 12, label: 'Loan Maturity (12 mo)' },
        { months: 6,  label: 'Loan Maturity (6 mo)' },
        { months: 3,  label: 'Loan Maturity (3 mo)' },
      ]) {
        const dueDate = new Date(maturity)
        dueDate.setMonth(dueDate.getMonth() - months)
        if (dueDate > now) {
          toCreate.push({
            dealId, tenantId: deal.tenantId,
            eventType: EventType.LOAN_MATURITY,
            label, dueDate, status: EventStatus.PENDING,
          })
        }
      }

      toCreate.push({
        dealId, tenantId: deal.tenantId,
        eventType: EventType.LOAN_MATURITY,
        label: 'Loan Maturity',
        dueDate: maturity,
        status: maturity < now ? EventStatus.OVERDUE : EventStatus.PENDING,
      })
    }

    // Unit lease-end events: group by month, one event per month with leases ending
    // Only for leases ending within the next 12 months; don't spam for past-due
    const rollResult = RentRollSchema.safeParse(mf.rentRoll)
    if (rollResult.success) {
      const units = rollResult.data.units
      const horizon = new Date(now)
      horizon.setFullYear(horizon.getFullYear() + 1)

      // Group occupied/notice units with upcoming lease ends by calendar month
      const byMonth = new Map<string, { count: number; earliest: Date }>()

      for (const unit of units as RentRollUnit[]) {
        if (!unit.leaseEnd || unit.status === 'VACANT') continue
        const end = new Date(unit.leaseEnd)
        if (end <= now || end > horizon) continue

        const key = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}`
        const existing = byMonth.get(key)
        if (!existing) {
          byMonth.set(key, { count: 1, earliest: end })
        } else {
          existing.count++
          if (end < existing.earliest) existing.earliest = end
        }
      }

      for (const [, { count, earliest }] of byMonth) {
        toCreate.push({
          dealId, tenantId: deal.tenantId,
          eventType: EventType.UNIT_LEASE_END,
          label: `${count} unit lease${count > 1 ? 's' : ''} expiring`,
          dueDate: earliest,
          status: EventStatus.PENDING,
        })
      }
    }

    if (toCreate.length > 0) {
      await tx.event.createMany({ data: toCreate })
    }
  })
}
