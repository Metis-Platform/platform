import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { syncUserToDatabase } from '@/lib/sync-user'

const updateSchema = z.object({
  type: z.enum(['OWNER','ATTORNEY','AGENT','LENDER','BUYER','SELLER','AGENCY','CONTRACTOR','TENANT','VENDOR','OTHER']).optional(),
  pipelineStage: z.enum(['LEAD','CONTACTED','NEGOTIATING','UNDER_CONTRACT','CLOSED','DEAD']).optional(),
  firstName: z.string().max(100).optional().nullable(),
  lastName: z.string().max(100).optional().nullable(),
  company: z.string().max(200).optional().nullable(),
  email: z.string().email().max(255).optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  address: z.string().max(255).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(2).optional().nullable(),
  zip: z.string().max(10).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
})

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const synced = await syncUserToDatabase()
  if (!synced) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { tenant } = synced
  const { id } = await params

  const contact = await db.contact.findUnique({
    where: { id, tenantId: tenant.id },
    include: {
      activities: { orderBy: { occurredAt: 'desc' } },
      deals: { select: { id: true, strategyType: true, status: true, property: { select: { address: true, city: true, state: true } } } },
      buyerProfile: true,
    },
  })

  if (!contact) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ contact })
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const synced = await syncUserToDatabase()
  if (!synced) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { tenant } = synced
  const { id } = await params

  const existing = await db.contact.findUnique({ where: { id, tenantId: tenant.id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const parsed = updateSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const contact = await db.contact.update({ where: { id }, data: parsed.data })
  return NextResponse.json({ contact })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const synced = await syncUserToDatabase()
  if (!synced) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { tenant } = synced
  const { id } = await params

  const existing = await db.contact.findUnique({ where: { id, tenantId: tenant.id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.contact.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
