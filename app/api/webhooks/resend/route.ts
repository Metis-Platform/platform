import { NextRequest, NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { db } from '@/lib/db'
import { Prisma } from '@/app/generated/prisma'

export async function POST(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  const body = await req.text()
  const headers = {
    'svix-id':        req.headers.get('svix-id') ?? '',
    'svix-timestamp': req.headers.get('svix-timestamp') ?? '',
    'svix-signature': req.headers.get('svix-signature') ?? '',
  }

  let payload: Record<string, unknown>
  try {
    const wh = new Webhook(secret)
    payload = wh.verify(body, headers) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const eventType = payload.type as string
  const data = (payload.data ?? {}) as Record<string, unknown>
  const email = (data.to ?? data.email_id ?? '') as string

  // Only store delivery-relevant events for the health dashboard
  const relevantTypes = ['email.bounced', 'email.complained', 'email.delivery_delayed']
  if (!relevantTypes.includes(eventType)) {
    return NextResponse.json({ ok: true })
  }

  // Try to resolve tenant from the recipient email address
  let tenantId: string | null = null
  if (email) {
    const user = await db.user.findFirst({ where: { email }, select: { tenantId: true } })
    tenantId = user?.tenantId ?? null
  }

  await db.emailEvent.create({
    data: {
      tenantId,
      type: eventType.replace('email.', ''), // 'bounced', 'complained', 'delivery_delayed'
      email,
      meta: data as Prisma.InputJsonValue,
    },
  })

  return NextResponse.json({ ok: true })
}
