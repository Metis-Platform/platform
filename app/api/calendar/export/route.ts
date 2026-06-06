import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@/app/generated/prisma'
import { db } from '@/lib/db'
import { syncUserToDatabase } from '@/lib/sync-user'

export const dynamic = 'force-dynamic'

type IcsItem = {
  id: string
  title: string
  description: string
  dueDate: Date
  url: string
}

function escapeIcsText(value: string) {
  const slash = String.fromCharCode(92)
  return value
    .split(slash).join(`${slash}${slash}`)
    .replaceAll(';', `${slash};`)
    .replaceAll(',', `${slash},`)
    .replaceAll(String.fromCharCode(13, 10), `${slash}n`)
    .replaceAll(String.fromCharCode(13), `${slash}n`)
    .replaceAll(String.fromCharCode(10), `${slash}n`)
}

const utf8Encoder = new TextEncoder()

function foldIcsLine(line: string) {
  const chunks: string[] = []
  let current = ''

  for (const char of line) {
    const candidate = `${current}${char}`
    if (current && utf8Encoder.encode(candidate).length > 75) {
      chunks.push(current)
      current = ` ${char}`
    } else {
      current = candidate
    }
  }

  chunks.push(current)
  return chunks.join(String.fromCharCode(13, 10))
}

function formatIcsDate(date: Date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

function buildIcs(items: IcsItem[], generatedAt = new Date()) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Metis Platform//Calendar Export//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Metis deadlines',
  ]

  for (const item of items) {
    const start = new Date(item.dueDate)
    const end = new Date(start.getTime() + 60 * 60 * 1000)

    lines.push(
      'BEGIN:VEVENT',
      `UID:${escapeIcsText(`${item.id}@metis-platform`)}`,
      `DTSTAMP:${formatIcsDate(generatedAt)}`,
      `DTSTART:${formatIcsDate(start)}`,
      `DTEND:${formatIcsDate(end)}`,
      `SUMMARY:${escapeIcsText(item.title)}`,
      `DESCRIPTION:${escapeIcsText(item.description)}`,
      `URL:${escapeIcsText(item.url)}`,
      'END:VEVENT',
    )
  }

  lines.push('END:VCALENDAR')
  return `${lines.map(foldIcsLine).join('\r\n')}\r\n`
}

function appBaseUrl(req: NextRequest) {
  const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
  if (configured) {
    return configured.startsWith('http') ? configured : `https://${configured}`
  }

  if (req.nextUrl.hostname === 'localhost' || req.nextUrl.hostname === '127.0.0.1') {
    return req.nextUrl.origin
  }

  throw new Error('Calendar export requires NEXT_PUBLIC_APP_URL or VERCEL_URL')
}

export async function GET(req: NextRequest) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const synced = await syncUserToDatabase()
  if (!synced) return NextResponse.json({ error: 'Tenant not found' }, { status: 403 })
  const { tenant } = synced

  const now = new Date()
  const windowStart = new Date(now)
  windowStart.setFullYear(windowStart.getFullYear() - 1)
  const windowEnd = new Date(now)
  windowEnd.setFullYear(windowEnd.getFullYear() + 2)

  type EventWithDeal = Prisma.EventGetPayload<{ include: { deal: { include: { property: true } } } }>
  type TaskWithDeal = Prisma.TaskGetPayload<{ include: { deal: { include: { property: true } } } }>
  let events: EventWithDeal[]
  let tasks: TaskWithDeal[]

  try {
    ;[events, tasks] = await Promise.all([
      db.event.findMany({
        where: {
          deal: { tenantId: tenant.id },
          dueDate: { gte: windowStart, lte: windowEnd },
          status: { notIn: ['COMPLETED', 'SKIPPED'] },
        },
        include: { deal: { include: { property: true } } },
        orderBy: { dueDate: 'asc' },
      }),
      db.task.findMany({
        where: {
          tenantId: tenant.id,
          dueDate: { gte: windowStart, lte: windowEnd },
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
        },
        include: { deal: { include: { property: true } } },
        orderBy: { dueDate: 'asc' },
      }),
    ])
  } catch {
    return NextResponse.json({ error: 'Calendar export failed' }, { status: 500 })
  }

  let baseUrl: string
  try {
    baseUrl = appBaseUrl(req)
  } catch {
    return NextResponse.json({ error: 'Calendar export is not configured' }, { status: 500 })
  }

  const eventItems: IcsItem[] = events.map(event => {
    const dealUrl = `${baseUrl}/dashboard/deals/${event.dealId}`
    const apn = event.deal.property.apn
    const address = event.deal.property.address ? `\nAddress: ${event.deal.property.address}` : ''
    return {
      id: `event-${event.id}`,
      title: `${event.label} — APN ${apn}`,
      description: `Metis deadline\nAPN: ${apn}${address}\nStatus: ${event.status}\nDeal: ${dealUrl}`,
      dueDate: event.dueDate,
      url: dealUrl,
    }
  })

  const taskItems: IcsItem[] = tasks.map(task => {
    const dealUrl = `${baseUrl}/dashboard/deals/${task.dealId}`
    const apn = task.deal.property.apn
    const address = task.deal.property.address ? `\nAddress: ${task.deal.property.address}` : ''
    return {
      id: `task-${task.id}`,
      title: `Task: ${task.title} — APN ${apn}`,
      description: `Metis task\nAPN: ${apn}${address}\nPriority: ${task.priority}\nStatus: ${task.status}\nDeal: ${dealUrl}`,
      dueDate: task.dueDate!,
      url: dealUrl,
    }
  })

  const body = buildIcs([...eventItems, ...taskItems].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime()))

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="metis-deadlines.ics"',
      'Cache-Control': 'private, no-store',
    },
  })
}
