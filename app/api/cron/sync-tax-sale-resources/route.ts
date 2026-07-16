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
import { disabledAuctionFeedResult } from '@/lib/auction-feed-availability'
import { guardCronRequest } from '@/lib/cron-guard'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(req: NextRequest) {
  const blocked = guardCronRequest(req, { requiredSideEffects: ['auction'] })
  if (blocked) return blocked
  return NextResponse.json(disabledAuctionFeedResult('TAX_SALE_RESOURCES'))
}
