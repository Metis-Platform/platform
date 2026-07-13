import { db } from '@/lib/db'
import { AuctionFeedSource, DealStatus } from '@/app/generated/prisma'
import { assertSideEffectAllowed, type RuntimeEnvironment } from '@/lib/side-effect-policy'

export type AuctionSaleData = {
  jurisdictionId: string
  source: AuctionFeedSource
  saleDate: Date
  registrationDeadline?: Date
  depositRequirementCents?: number
  platformUrl?: string
  notes?: string
}

export async function upsertAuctionSales(
  sales: AuctionSaleData[],
  env: RuntimeEnvironment = process.env
): Promise<number> {
  assertSideEffectAllowed('auction', env)
  const now = new Date()
  let count = 0
  for (const sale of sales) {
    await db.auctionSaleFeed.upsert({
      where: {
        jurisdictionId_source_saleDate: {
          jurisdictionId: sale.jurisdictionId,
          source: sale.source,
          saleDate: sale.saleDate,
        },
      },
      create: {
        jurisdictionId: sale.jurisdictionId,
        source: sale.source,
        saleDate: sale.saleDate,
        registrationDeadline: sale.registrationDeadline ?? null,
        depositRequirementCents: sale.depositRequirementCents ?? null,
        platformUrl: sale.platformUrl ?? null,
        notes: sale.notes ?? null,
        syncedAt: now,
      },
      update: {
        registrationDeadline: sale.registrationDeadline ?? null,
        depositRequirementCents: sale.depositRequirementCents ?? null,
        platformUrl: sale.platformUrl ?? null,
        notes: sale.notes ?? null,
        syncedAt: now,
      },
    })
    count++
  }
  return count
}

const ARCHIVED_STATUSES: DealStatus[] = [
  DealStatus.SOLD,
  DealStatus.CLOSED,
  DealStatus.NOT_WON,
  DealStatus.EXPIRED,
]

export async function createTaxSaleEvents(
  jurisdictionId: string,
  saleDate: Date,
  label: string,
  notes?: string,
  env: RuntimeEnvironment = process.env,
): Promise<number> {
  assertSideEffectAllowed('auction', env)
  const deals = await db.deal.findMany({
    where: {
      status: { notIn: ARCHIVED_STATUSES },
      property: { jurisdictionId },
    },
    select: { id: true },
  })
  if (deals.length === 0) return 0

  const dealIds = deals.map((d) => d.id)

  const existing = await db.event.findMany({
    where: {
      dealId: { in: dealIds },
      eventType: 'TAX_SALE',
      dueDate: saleDate,
    },
    select: { dealId: true },
  })
  const alreadyHasEvent = new Set(existing.map((e) => e.dealId))

  const toCreate = dealIds.filter((id) => !alreadyHasEvent.has(id))
  if (toCreate.length === 0) return 0

  await db.event.createMany({
    data: toCreate.map((dealId) => ({
      dealId,
      eventType: 'TAX_SALE' as const,
      label,
      dueDate: saleDate,
      notes: notes ?? null,
    })),
  })
  return toCreate.length
}
