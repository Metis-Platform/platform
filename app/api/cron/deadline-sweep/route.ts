/**
 * /api/cron/deadline-sweep
 *
 * Nightly cron job that keeps Event statuses accurate.
 *
 * Vercel invokes this route on the schedule defined in vercel.json.
 * Requests from Vercel Cron include an Authorization header; all other
 * callers receive a 401.
 *
 * What it does:
 *   1. Marks PENDING events as OVERDUE when their dueDate has passed.
 *   2. Returns a JSON summary of the sweep for logging purposes.
 */

import { NextRequest, NextResponse } from 'next/server'
import { refreshEventStatuses } from '@/lib/rules-engine'
import { guardCronRequest } from '@/lib/cron-guard'

export async function GET(req: NextRequest) {
  const blocked = guardCronRequest(req)
  if (blocked) return blocked

  try {
    const overdueCount = await refreshEventStatuses() // all tenants

    return NextResponse.json({
      ok: true,
      swept: new Date().toISOString(),
      overdueMarked: overdueCount,
    })
  } catch (err) {
    console.error('[cron/deadline-sweep] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
