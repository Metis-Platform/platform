import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { isSuperAdmin } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import { auth } from '@clerk/nextjs/server'

const Schema = z.object({
  message: z.string().min(1).max(500),
  severity: z.enum(['INFO', 'WARNING']).default('INFO'),
  endsAt: z.string().datetime(),
})

export async function GET(): Promise<NextResponse> {
  if (!(await isSuperAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const announcements = await db.announcement.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
  })
  return NextResponse.json(announcements)
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!(await isSuperAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { userId } = await auth()
  const body = await req.json()
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const announcement = await db.announcement.create({
    data: {
      message: parsed.data.message,
      severity: parsed.data.severity,
      endsAt: new Date(parsed.data.endsAt),
      createdBy: userId,
    },
  })

  return NextResponse.json(announcement, { status: 201 })
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  if (!(await isSuperAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  await db.announcement.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
