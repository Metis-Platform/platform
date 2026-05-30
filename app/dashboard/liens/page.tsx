import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { syncUserToDatabase } from '@/lib/sync-user'
import { db } from '@/lib/db'
import { StrategyType, EventStatus } from '@/app/generated/prisma'
import LienList, { type LienRow } from './LienList'

export default async function LiensPage() {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) redirect('/sign-in')

  const synced = await syncUserToDatabase()
  if (!synced) redirect('/onboarding')
  const { tenant } = synced

  const deals = await db.deal.findMany({
    where: { tenantId: tenant.id, strategyType: StrategyType.TAX_LIEN },
    include: {
      property: { include: { jurisdiction: true } },
      taxLien: true,
      events: { where: { status: EventStatus.PENDING }, orderBy: { dueDate: 'asc' }, take: 1 },
      _count: { select: { events: { where: { status: EventStatus.OVERDUE } } } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const now = Date.now()

  const rows: LienRow[] = deals.map(d => {
    const next = d.events[0] ?? null
    return {
      id:                d.id,
      status:            d.status,
      overdueCount:      d._count.events,
      apn:               d.property.apn,
      address:           d.property.address,
      county:            d.property.jurisdiction.county,
      state:             d.property.jurisdiction.state,
      certificateNumber: d.taxLien?.certificateNumber ?? null,
      issueDate:         d.taxLien?.issueDate?.toISOString() ?? null,
      auctionDate:       d.taxLien?.auctionDate?.toISOString() ?? null,
      faceAmount:        d.taxLien?.faceAmount != null ? Number(d.taxLien.faceAmount) : null,
      nextDeadlineLabel: next?.label ?? null,
      nextDeadlineDays:  next ? Math.round((next.dueDate.getTime() - now) / 86_400_000) : null,
    }
  })

  return <LienList deals={rows} />
}
