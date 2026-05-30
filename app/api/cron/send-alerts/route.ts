/**
 * /api/cron/send-alerts
 *
 * Daily digest email to each tenant's Owner-role users.
 * Runs at 07:00 UTC every day via Vercel Cron.
 *
 * Bucketing:
 *   Overdue   — dueDate < today (EventStatus.OVERDUE)
 *   Due Soon  — dueDate within 7 calendar days (PENDING)
 *   Upcoming  — dueDate 8–30 calendar days out (PENDING)
 *
 * Tenants with zero items in all three buckets receive no email.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sendDailyDigest, type AlertEvent } from '@/lib/email'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://metisplatform.com'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now      = new Date()
  const in7days  = new Date(now.getTime() + 7  * 86_400_000)
  const in30days = new Date(now.getTime() + 30 * 86_400_000)

  // Fetch all tenants that have at least one relevant event
  const tenants = await db.tenant.findMany({
    include: {
      users: {
        where: { role: 'OWNER' },
        select: { email: true, name: true },
      },
    },
  })

  let emailsSent  = 0
  let emailsSkipped = 0
  const errors: string[] = []

  for (const tenant of tenants) {
    const ownerEmails = tenant.users.map(u => u.email).filter(Boolean)
    if (ownerEmails.length === 0) { emailsSkipped++; continue }

    // Pull overdue + upcoming events for this tenant
    const events = await db.event.findMany({
      where: {
        deal: { tenantId: tenant.id },
        status: { in: ['OVERDUE', 'PENDING'] },
        dueDate: { lte: in30days },
      },
      include: {
        deal: { include: { property: { include: { jurisdiction: true } } } },
      },
      orderBy: { dueDate: 'asc' },
    })

    const toAlert = (e: typeof events[number]): AlertEvent => ({
      label:  e.label,
      dueDate: e.dueDate,
      apn:    e.deal.property.apn,
      county: e.deal.property.jurisdiction.county,
      state:  e.deal.property.jurisdiction.state,
      dealId: e.dealId,
    })

    const overdue  = events.filter(e => e.status === 'OVERDUE').map(toAlert)
    const dueSoon  = events.filter(e => e.status === 'PENDING' && e.dueDate <= in7days).map(toAlert)
    const upcoming = events.filter(e => e.status === 'PENDING' && e.dueDate > in7days && e.dueDate <= in30days).map(toAlert)

    if (overdue.length + dueSoon.length + upcoming.length === 0) {
      emailsSkipped++
      continue
    }

    try {
      await sendDailyDigest({
        to: ownerEmails,
        tenantName: tenant.name,
        overdue,
        dueSoon,
        upcoming,
        appUrl: APP_URL,
      })
      emailsSent++
    } catch (err) {
      errors.push(`${tenant.name}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return NextResponse.json({
    ok: true,
    ran: now.toISOString(),
    emailsSent,
    emailsSkipped,
    errors,
  })
}
