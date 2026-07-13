import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sendEmail } from '@/lib/email'
import { guardCronRequest } from '@/lib/cron-guard'

export const dynamic = 'force-dynamic'

export async function GET(req: Request): Promise<NextResponse> {
  const blocked = guardCronRequest(req)
  if (blocked) return blocked

  const now = new Date()
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
  const from = process.env.EMAIL_FROM ?? 'noreply@metisplatforms.com'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://metisplatforms.com'

  // 1. Expire modules whose trial has ended
  const expired = await db.tenantModule.findMany({
    where: { trialEndsAt: { not: null, lt: now } },
    include: { tenant: { include: { users: { where: { role: 'OWNER' }, select: { email: true }, take: 1 } } } },
  })

  let expiredCount = 0
  for (const mod of expired) {
    await db.tenantModule.delete({ where: { id: mod.id } })
    expiredCount++

    const ownerEmail = mod.tenant.users[0]?.email
    if (ownerEmail) {
      try {
        await sendEmail({
          from,
          to: ownerEmail,
          subject: `Your ${mod.strategy.replace(/_/g, ' ')} trial has ended — Metis`,
          html: `<div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px">
            <p>Hi,</p>
            <p>Your free trial for the <strong>${mod.strategy.replace(/_/g, ' ')}</strong> module on Metis has ended and access has been revoked.</p>
            <p>To restore access, <a href="${appUrl}/dashboard/billing">purchase the module</a> from your billing page.</p>
            <p>Questions? Reply to this email or contact us at <a href="mailto:support@metisplatforms.com">support@metisplatforms.com</a>.</p>
            <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
            <p style="font-size:12px;color:#999">Metis Platform · <a href="${appUrl}/dashboard">Open Dashboard</a></p>
          </div>`,
        })
      } catch { /* non-blocking */ }
    }
  }

  // 2. Send 3-day warning for trials expiring soon (only send once — check not already warned)
  // Query modules expiring within 3 days that haven't expired yet
  const expiringSoon = await db.tenantModule.findMany({
    where: {
      trialEndsAt: { gt: now, lte: threeDaysFromNow },
    },
    include: { tenant: { include: { users: { where: { role: 'OWNER' }, select: { email: true }, take: 1 } } } },
  })

  let warningCount = 0
  for (const mod of expiringSoon) {
    const ownerEmail = mod.tenant.users[0]?.email
    if (!ownerEmail || !mod.trialEndsAt) continue

    const daysLeft = Math.ceil((mod.trialEndsAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))

    // Only send on the day it crosses 3 days (avoid sending every day)
    if (daysLeft !== 3) continue

    try {
      await sendEmail({
        from,
        to: ownerEmail,
        subject: `Your ${mod.strategy.replace(/_/g, ' ')} trial expires in ${daysLeft} days — Metis`,
        html: `<div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px">
          <p>Hi,</p>
          <p>Your free trial for the <strong>${mod.strategy.replace(/_/g, ' ')}</strong> module on Metis expires in <strong>${daysLeft} days</strong> (${mod.trialEndsAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}).</p>
          <p>To keep your access, <a href="${appUrl}/dashboard/billing">purchase the module</a> before your trial ends.</p>
          <p>Questions? Contact us at <a href="mailto:support@metisplatforms.com">support@metisplatforms.com</a>.</p>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
          <p style="font-size:12px;color:#999">Metis Platform · <a href="${appUrl}/dashboard">Open Dashboard</a></p>
        </div>`,
      })
      warningCount++
    } catch { /* non-blocking */ }
  }

  return NextResponse.json({ ok: true, expired: expiredCount, warned: warningCount })
}
