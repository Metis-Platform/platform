import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { isSuperAdmin } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import { sendEmail } from '@/lib/email'
import { emitAuditEvent } from '@/lib/audit'
import { auth } from '@clerk/nextjs/server'

const TenantEmailSchema = z.object({
  tenantId: z.string().min(1),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(10000),
})

const BroadcastSchema = z.object({
  broadcast: z.literal(true),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(10000),
})

const Schema = z.union([TenantEmailSchema, BroadcastSchema])

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!(await isSuperAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { userId } = await auth()
  const body = await req.json()
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const from = process.env.EMAIL_FROM ?? 'noreply@metisplatforms.com'

  if ('broadcast' in parsed.data) {
    // Rate limit: 1 broadcast per 24h
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const recentBroadcast = await db.auditEvent.findFirst({
      where: { action: 'ADMIN_EMAIL_SENT', createdAt: { gte: oneDayAgo }, meta: { path: ['broadcast'], equals: true } },
    })
    if (recentBroadcast) {
      return NextResponse.json({ error: 'Broadcast rate limit: 1 per 24 hours' }, { status: 429 })
    }

    // Send to one owner per active tenant
    const tenants = await db.tenant.findMany({
      include: {
        users: {
          where: { role: 'OWNER' },
          select: { email: true },
          take: 1,
        },
      },
    })

    const recipients = tenants.flatMap(t => t.users.map(u => u.email)).filter(Boolean)
    if (recipients.length === 0) return NextResponse.json({ error: 'No recipients found' }, { status: 400 })

    let sent = 0
    let sunk = 0
    let failed = 0
    for (const email of recipients) {
      try {
        const delivery = await sendEmail({
          from,
          to: email,
          subject: parsed.data.subject,
          html: `<div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px"><p>${parsed.data.body.replace(/\n/g, '<br>')}</p><hr style="border:none;border-top:1px solid #eee;margin:24px 0"><p style="font-size:12px;color:#999">Sent from Metis Platform admin</p></div>`,
        })
        if (delivery === 'sent') sent++
        else sunk++
      } catch {
        failed++
      }
    }

    await emitAuditEvent('system', 'ADMIN_EMAIL_SENT', {
      broadcast: true,
      sent,
      sunk,
      failed,
      subject: parsed.data.subject,
    }, userId ?? undefined)

    return NextResponse.json({ sent, sunk, failed })
  } else {
    // Per-tenant email
    const tenant = await db.tenant.findUnique({
      where: { id: parsed.data.tenantId },
      include: { users: { select: { email: true } } },
    })
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const recipients = tenant.users.map(u => u.email).filter(Boolean)
    if (recipients.length === 0) return NextResponse.json({ error: 'No users in this tenant' }, { status: 400 })

    const delivery = await sendEmail({
      from,
      to: recipients,
      subject: parsed.data.subject,
      html: `<div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px"><p>${parsed.data.body.replace(/\n/g, '<br>')}</p><hr style="border:none;border-top:1px solid #eee;margin:24px 0"><p style="font-size:12px;color:#999">Sent from Metis Platform admin · <a href="https://metisplatforms.com/dashboard">Open Dashboard</a></p></div>`,
    })

    await emitAuditEvent(tenant.id, 'ADMIN_EMAIL_SENT', {
      subject: parsed.data.subject,
      recipients: delivery === 'sent' ? recipients.length : 0,
      sunk: delivery === 'sunk' ? recipients.length : 0,
    }, userId ?? undefined)

    return NextResponse.json({
      sent: delivery === 'sent' ? recipients.length : 0,
      sunk: delivery === 'sunk' ? recipients.length : 0,
    })
  }
}
