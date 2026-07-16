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
import { disabledAuctionFeedResult } from '@/lib/auction-feed-availability'
import { guardCronRequest } from '@/lib/cron-guard'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(req: NextRequest) {
  const blocked = guardCronRequest(req, { requiredSideEffects: ['auction'] })
  if (blocked) return blocked
  return NextResponse.json(disabledAuctionFeedResult('GOVEASE'))
}
