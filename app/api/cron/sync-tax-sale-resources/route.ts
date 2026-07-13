/**
 * /api/cron/sync-tax-sale-resources
 *
 * Weekly sync from the Tax Sale Resources Premier API.
 * Requires TAX_SALE_RESOURCES_API_KEY env var — skips gracefully if unset.
 *
 * For each upcoming sale returned by the API:
 *   1. Upserts an AuctionSaleFeed row for the matching jurisdiction
 *   2. Creates a TAX_SALE Event on any active deals in that county
 *
 * TODO — API implementation: when the Premier subscription is active, replace
 * fetchUpcomingSales() with real calls. The API base URL and response shape
 * are documented at https://www.taxsaleresources.com/api-docs (requires login).
 * Expected fields: state, county, saleDate, registrationDeadline, depositAmount.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { upsertAuctionSales, createTaxSaleEvents } from '@/lib/auction-feeds'
import { AuctionFeedSource } from '@/app/generated/prisma'
import { guardCronRequest } from '@/lib/cron-guard'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

type TsrSale = {
  state: string
  county: string
  saleDate: string // ISO date string
  registrationDeadline?: string
  depositAmountCents?: number
  platformUrl?: string
}

// TODO: replace with real Tax Sale Resources Premier API call
// Endpoint: GET https://api.taxsaleresources.com/v1/upcoming-sales
// Headers: { 'X-Api-Key': process.env.TAX_SALE_RESOURCES_API_KEY }
async function fetchUpcomingSales(_apiKey: string): Promise<TsrSale[]> {
  return []
}

export async function GET(req: NextRequest) {
  const blocked = guardCronRequest(req, { requiredSideEffects: ['auction'] })
  if (blocked) return blocked

  const apiKey = process.env.TAX_SALE_RESOURCES_API_KEY
  if (!apiKey) {
    return NextResponse.json({ skipped: true, reason: 'TAX_SALE_RESOURCES_API_KEY not configured' })
  }

  try {
    const sales = await fetchUpcomingSales(apiKey)

    let upserted = 0
    let eventsCreated = 0

    for (const sale of sales) {
      const jurisdiction = await db.jurisdiction.findFirst({
        where: { state: sale.state, county: { contains: sale.county, mode: 'insensitive' } },
        select: { id: true, county: true },
      })
      if (!jurisdiction) continue

      const saleDate = new Date(sale.saleDate)

      await upsertAuctionSales([{
        jurisdictionId: jurisdiction.id,
        source: AuctionFeedSource.TAX_SALE_RESOURCES,
        saleDate,
        registrationDeadline: sale.registrationDeadline ? new Date(sale.registrationDeadline) : undefined,
        depositRequirementCents: sale.depositAmountCents,
        platformUrl: sale.platformUrl,
      }])
      upserted++

      const label = `Tax Sale — ${jurisdiction.county}`
      const notes = sale.registrationDeadline
        ? `Registration deadline: ${new Date(sale.registrationDeadline).toLocaleDateString()}`
        : undefined
      eventsCreated += await createTaxSaleEvents(jurisdiction.id, saleDate, label, notes)
    }

    return NextResponse.json({ ok: true, upserted, eventsCreated })
  } catch (err) {
    console.error('[sync-tax-sale-resources]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
