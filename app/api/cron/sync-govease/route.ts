/**
 * /api/cron/sync-govease
 *
 * Weekly sync of tax sale auction calendars from GovEase.
 * Active in 14 states: AL, AZ, CA, CO, GA, IA, IN, LA, MS, OK, TN, TX, PA, WA
 *
 * For each upcoming sale found:
 *   1. Upserts an AuctionSaleFeed row for the matching jurisdiction
 *   2. Creates a TAX_SALE Event on any active deals in that county
 *
 * TODO — scraper implementation: GovEase county auction pages are public at
 *   https://www.govease.com/counties/
 * Each county has a page listing upcoming auction dates, deposit requirements,
 * and registration deadlines. Scrape the county list first, then iterate.
 * The county slug format is typically "{state-abbreviation}-{county-name}" (lowercase, hyphenated).
 * Fields to extract: saleDate, registrationDeadline, depositAmount, platformUrl (county page URL).
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { upsertAuctionSales, createTaxSaleEvents } from '@/lib/auction-feeds'
import { AuctionFeedSource } from '@/app/generated/prisma'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// States where GovEase operates
const GOVEASE_STATES = ['AL', 'AZ', 'CA', 'CO', 'GA', 'IA', 'IN', 'LA', 'MS', 'OK', 'TN', 'TX', 'PA', 'WA']

type GovEaseSale = {
  state: string
  county: string
  saleDate: string // ISO date string
  registrationDeadline?: string
  depositRequirementCents?: number
  platformUrl?: string
}

// TODO: replace with real scrape of govease.com/counties/ pages
// Approach: fetch https://www.govease.com/counties/ → extract county links for GOVEASE_STATES
// → for each county page, extract upcoming auction table rows
async function fetchGovEaseSales(): Promise<GovEaseSale[]> {
  return []
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const sales = await fetchGovEaseSales()

    let upserted = 0
    let eventsCreated = 0

    for (const sale of sales) {
      if (!GOVEASE_STATES.includes(sale.state)) continue

      const jurisdiction = await db.jurisdiction.findFirst({
        where: { state: sale.state, county: { contains: sale.county, mode: 'insensitive' } },
        select: { id: true, county: true },
      })
      if (!jurisdiction) continue

      const saleDate = new Date(sale.saleDate)

      await upsertAuctionSales([{
        jurisdictionId: jurisdiction.id,
        source: AuctionFeedSource.GOVEASE,
        saleDate,
        registrationDeadline: sale.registrationDeadline ? new Date(sale.registrationDeadline) : undefined,
        depositRequirementCents: sale.depositRequirementCents,
        platformUrl: sale.platformUrl,
      }])
      upserted++

      const notes = [
        sale.registrationDeadline && `Registration: ${new Date(sale.registrationDeadline).toLocaleDateString()}`,
        sale.depositRequirementCents && `Deposit: $${(sale.depositRequirementCents / 100).toLocaleString()}`,
      ].filter(Boolean).join(' · ') || undefined

      eventsCreated += await createTaxSaleEvents(
        jurisdiction.id,
        saleDate,
        `Tax Sale — ${jurisdiction.county}`,
        notes,
      )
    }

    return NextResponse.json({ ok: true, upserted, eventsCreated, states: GOVEASE_STATES })
  } catch (err) {
    console.error('[sync-govease]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
