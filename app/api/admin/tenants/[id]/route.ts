import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { isSuperAdmin } from '@/lib/admin-auth'

const patchSchema = z.object({
  adminNotes: z.string(),
})

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isSuperAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params

  const tenant = await db.tenant.findUnique({
    where: { id },
    include: {
      users: { orderBy: { createdAt: 'asc' } },
      modules: { orderBy: { strategy: 'asc' } },
    },
  })
  if (!tenant) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [dealCounts, recentDeal] = await Promise.all([
    db.deal.groupBy({
      by: ['strategyType'],
      where: { tenantId: id },
      _count: true,
    }),
    db.deal.findFirst({
      where: { tenantId: id },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, updatedAt: true, strategyType: true },
    }),
  ])

  return NextResponse.json({ tenant, dealCounts, recentDeal })
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isSuperAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const tenant = await db.tenant.findUnique({ where: { id }, select: { id: true } })
  if (!tenant) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updated = await db.tenant.update({
    where: { id },
    data: { adminNotes: parsed.data.adminNotes },
    select: { adminNotes: true },
  })
  return NextResponse.json(updated)
}
