import { NextResponse } from 'next/server'
import { z } from 'zod'
import { isSuperAdmin } from '@/lib/admin-auth'
import { db } from '@/lib/db'

const schema = z.object({ status: z.enum(['DISCOVERING', 'PAUSED']), pausedReason: z.string().trim().max(4000).optional() })

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isSuperAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  if (parsed.data.status === 'PAUSED' && !parsed.data.pausedReason) {
    return NextResponse.json({ error: 'A pause reason is required.' }, { status: 400 })
  }
  const { id } = await params
  const work = await db.jurisdictionResearchWork.update({
    where: { id },
    data: parsed.data.status === 'PAUSED'
      ? { status: 'PAUSED', pausedAt: new Date(), pausedReason: parsed.data.pausedReason }
      : { status: 'DISCOVERING', startedAt: new Date(), pausedAt: null, pausedReason: null },
  }).catch(() => null)
  if (!work) return NextResponse.json({ error: 'Research work not found' }, { status: 404 })
  return NextResponse.json({ work })
}
