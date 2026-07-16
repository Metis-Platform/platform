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
import { disabledAuctionFeedResult } from '@/lib/auction-feed-availability'
import { guardCronRequest } from '@/lib/cron-guard'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(req: NextRequest) {
  const blocked = guardCronRequest(req, { requiredSideEffects: ['auction'] })
  if (blocked) return blocked
  return NextResponse.json(disabledAuctionFeedResult('REALAUCTION_FL'))
}
