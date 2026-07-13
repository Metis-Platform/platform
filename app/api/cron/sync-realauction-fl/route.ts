/**
 * /api/cron/sync-realauction-fl
 *
 * Weekly sync of Florida tax lien auction schedules from RealAuction / LienAuctions.
 * All 67 FL counties run lien auctions through this platform.
 *
 * For each upcoming sale found:
 *   1. Upserts an AuctionSaleFeed row for the matching FL jurisdiction
 *   2. Creates a TAX_SALE Event on any active deals in that county
 *
 * TODO — scraper implementation: RealAuction does not expose a public API.
 * The county auction calendar pages are at https://lienautions.com/ (login required
 * for some counties). Recommend using Playwright via a serverless-compatible approach,
 * or monitoring the county list at:
 *   https://www.realauction.com/county-list
 * Each county page lists upcoming sale dates, registration deadlines, and deposit requirements.
 * Response parsing should extract: county name, saleDate, registrationDeadline, depositAmount.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { upsertAuctionSales, createTaxSaleEvents } from '@/lib/auction-feeds'
import { AuctionFeedSource } from '@/app/generated/prisma'
import { guardCronRequest } from '@/lib/cron-guard'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

type RealAuctionSale = {
  county: string // e.g. "Miami-Dade"
  saleDate: string // ISO date string
  registrationDeadline?: string
  depositRequirementCents?: number
  platformUrl?: string
}

// TODO: replace with real scrape of lienautions.com / realauction.com county pages
async function fetchFlCountySales(): Promise<RealAuctionSale[]> {
  return []
}

export async function GET(req: NextRequest) {
  const blocked = guardCronRequest(req, { requiredSideEffects: ['auction'] })
  if (blocked) return blocked

  try {
    const sales = await fetchFlCountySales()

    let upserted = 0
    let eventsCreated = 0

    for (const sale of sales) {
      const jurisdiction = await db.jurisdiction.findFirst({
        where: { state: 'FL', county: { contains: sale.county, mode: 'insensitive' } },
        select: { id: true, county: true },
      })
      if (!jurisdiction) continue

      const saleDate = new Date(sale.saleDate)

      await upsertAuctionSales([{
        jurisdictionId: jurisdiction.id,
        source: AuctionFeedSource.REALAUCTION_FL,
        saleDate,
        registrationDeadline: sale.registrationDeadline ? new Date(sale.registrationDeadline) : undefined,
        depositRequirementCents: sale.depositRequirementCents,
        platformUrl: sale.platformUrl ?? 'https://lienautions.com',
      }])
      upserted++

      const notes = [
        sale.registrationDeadline && `Registration: ${new Date(sale.registrationDeadline).toLocaleDateString()}`,
        sale.depositRequirementCents && `Deposit: $${(sale.depositRequirementCents / 100).toLocaleString()}`,
      ].filter(Boolean).join(' · ') || undefined

      eventsCreated += await createTaxSaleEvents(
        jurisdiction.id,
        saleDate,
        `Tax Sale — ${jurisdiction.county} (FL)`,
        notes,
      )
    }

    return NextResponse.json({ ok: true, upserted, eventsCreated })
  } catch (err) {
    console.error('[sync-realauction-fl]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
