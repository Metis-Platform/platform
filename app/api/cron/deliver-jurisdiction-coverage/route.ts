import { NextResponse } from 'next/server'
import { guardCronRequest } from '@/lib/cron-guard'
import { deliverPendingCoverageNotifications } from '@/lib/jurisdiction-coverage-notification-delivery'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const blocked = guardCronRequest(request)
  if (blocked) return blocked
  const delivery = await deliverPendingCoverageNotifications()
  return NextResponse.json({ ok: true, delivery })
}
