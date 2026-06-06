import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { syncUserToDatabase } from '@/lib/sync-user'
import { db } from '@/lib/db'
import { StrategyType, EventStatus } from '@/app/generated/prisma'
import LienList, { type LienRow } from './LienList'

export default async function LiensPage({
  searchParams,
}: {
  searchParams: Promise<{ strategy?: string }>
}) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) redirect('/sign-in')

  const synced = await syncUserToDatabase()
  if (!synced) redirect('/onboarding')
  const { tenant } = synced

  const { strategy: strategyParam } = await searchParams
  const strategy = strategyParam === 'TAX_DEED' ? StrategyType.TAX_DEED
    : strategyParam === 'FORECLOSURE' ? StrategyType.FORECLOSURE
    : StrategyType.TAX_LIEN

  const deals = await db.deal.findMany({
    where: { tenantId: tenant.id, strategyType: strategy },
    include: {
      property: { include: { jurisdiction: true } },
      taxLien: true,
      taxDeed: true,
      foreclosure: true,
      events: { where: { status: EventStatus.PENDING }, orderBy: { dueDate: 'asc' }, take: 1 },
      _count: { select: { events: { where: { status: EventStatus.OVERDUE } } } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const now = new Date()

  const rows: LienRow[] = deals.map(d => {
    const next = d.events[0] ?? null
    const faceAmt =
      strategy === StrategyType.TAX_LIEN
        ? (d.taxLien?.faceAmount != null ? Number(d.taxLien.faceAmount) : null)
        : strategy === StrategyType.TAX_DEED
          ? (d.taxDeed?.winningBid != null ? Number(d.taxDeed.winningBid) : null)
          : (d.foreclosure?.winningBid != null ? Number(d.foreclosure.winningBid) : null)

    return {
      id:                d.id,
      status:            d.status,
      overdueCount:      d._count.events,
      apn:               d.property.apn,
      address:           d.property.address,
      county:            d.property.jurisdiction.county,
      state:             d.property.jurisdiction.state,
      certificateNumber: d.taxLien?.certificateNumber ?? null,
      issueDate:         d.taxLien?.issueDate?.toISOString()
                          ?? d.taxDeed?.saleDate?.toISOString()
                          ?? d.foreclosure?.auctionDate?.toISOString()
                          ?? null,
      auctionDate:       d.taxLien?.auctionDate?.toISOString()
                          ?? d.foreclosure?.auctionDate?.toISOString()
                          ?? null,
      faceAmount:        faceAmt,
      nextDeadlineLabel: next?.label ?? null,
      nextDeadlineDays:  next ? Math.round((next.dueDate.getTime() - now.getTime()) / 86_400_000) : null,
    }
  })

  return <LienList deals={rows} strategy={strategy} />
}
