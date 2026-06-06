import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { syncUserToDatabase } from '@/lib/sync-user'
import { db } from '@/lib/db'
import { StrategyType, EventStatus } from '@/app/generated/prisma'
import { parseStrategyParam } from '@/lib/strategy-meta'
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
  const strategy = parseStrategyParam(strategyParam) as StrategyType

  const deals = await db.deal.findMany({
    where: { tenantId: tenant.id, strategyType: strategy },
    include: {
      property: { include: { jurisdiction: true } },
      taxLien: true,
      taxDeed: true,
      foreclosure: true,
      fixFlip: true,
      land: true,
      wholesale: true,
      buyHold: true,
      multifamily: true,
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
          : strategy === StrategyType.FORECLOSURE
            ? (d.foreclosure?.winningBid != null ? Number(d.foreclosure.winningBid) : null)
            : strategy === StrategyType.FIX_FLIP
              ? (d.fixFlip?.arv != null ? Number(d.fixFlip.arv) : null)
              : strategy === StrategyType.WHOLESALE
                ? (d.wholesale?.contractPrice != null ? Number(d.wholesale.contractPrice) : null)
                : strategy === StrategyType.BUY_HOLD
                  ? (d.buyHold?.actualMonthlyRent != null ? Number(d.buyHold.actualMonthlyRent) : d.buyHold?.targetMonthlyRent != null ? Number(d.buyHold.targetMonthlyRent) : null)
                  : strategy === StrategyType.LAND
                    ? (d.purchasePrice != null ? Number(d.purchasePrice) : null)
                    : strategy === StrategyType.MULTIFAMILY
                      ? (d.multifamily?.netOperatingIncome != null ? Number(d.multifamily.netOperatingIncome) : null)
                      : null

    const ref = strategy === StrategyType.TAX_LIEN
      ? (d.taxLien?.certificateNumber ?? null)
      : strategy === StrategyType.FORECLOSURE
        ? (d.foreclosure?.foreclosureType ?? null)
        : strategy === StrategyType.MULTIFAMILY
          ? (d.multifamily?.unitCount != null ? String(d.multifamily.unitCount) : null)
          : null

    const primaryDate = d.taxLien?.issueDate
      ?? d.taxDeed?.saleDate
      ?? d.foreclosure?.auctionDate
      ?? d.fixFlip?.rehabStartDate
      ?? d.wholesale?.contractDate
      ?? d.buyHold?.leaseStartDate
      ?? d.land?.optionExpiry
      ?? d.purchaseDate
      ?? null

    return {
      id:                d.id,
      status:            d.status,
      overdueCount:      d._count.events,
      apn:               d.property.apn,
      address:           d.property.address,
      county:            d.property.jurisdiction.county,
      state:             d.property.jurisdiction.state,
      certificateNumber: ref,
      issueDate:         primaryDate?.toISOString() ?? null,
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
