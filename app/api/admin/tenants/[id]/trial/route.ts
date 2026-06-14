import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { isSuperAdmin } from '@/lib/admin-auth'

const schema = z.object({
  days: z.number().int().min(1).max(365),
})

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isSuperAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const tenant = await db.tenant.findUnique({ where: { id }, select: { id: true, trialEndsAt: true } })
  if (!tenant) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const base = tenant.trialEndsAt && tenant.trialEndsAt > new Date() ? tenant.trialEndsAt : new Date()
  const trialEndsAt = new Date(base.getTime() + parsed.data.days * 24 * 60 * 60 * 1000)

  const updated = await db.tenant.update({
    where: { id },
    data: { trialEndsAt },
    select: { trialEndsAt: true },
  })
  return NextResponse.json(updated)
}
