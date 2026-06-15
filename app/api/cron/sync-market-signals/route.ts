/**
 * /api/cron/sync-market-signals
 *
 * Quarterly refresh of county-level market signals for JurisdictionProfile.marketSignals.
 * Free sources run first: Census ACS, HUD FMR, and configured open-data delinquency feeds.
 * ATTOM is scaffolded and remains disabled unless ATTOM_API_KEY is present.
 */

import { NextRequest, NextResponse } from 'next/server'
import { syncMarketSignals } from '@/lib/market-signals'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await syncMarketSignals()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error('[sync-market-signals]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  return POST(req)
}
