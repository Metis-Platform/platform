import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { syncUserToDatabase } from '@/lib/sync-user'
import { requestIdFromHeaders } from '@/lib/request-correlation'

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

  const parsed = updateSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const contact = await db.$transaction(async transaction => {
    const existing = await transaction.contact.findFirst({
      where: { id, tenantId: tenant.id },
      select: { id: true },
    })
    if (!existing) return null

    const updated = await transaction.contact.update({ where: { id: existing.id }, data: parsed.data })
    await transaction.auditEvent.create({
      data: {
        tenantId: tenant.id,
        userId: synced.user.id,
        requestId: requestIdFromHeaders(req.headers),
        action: 'CONTACT_UPDATED',
        meta: { contactId: existing.id },
      },
    })
    return updated
  })
  if (!contact) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ contact })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const synced = await syncUserToDatabase()
  if (!synced) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { tenant } = synced
  const { id } = await params

  const deleted = await db.$transaction(async transaction => {
    const existing = await transaction.contact.findFirst({
      where: { id, tenantId: tenant.id },
      select: { id: true },
    })
    if (!existing) return false

    await transaction.contact.delete({ where: { id: existing.id } })
    await transaction.auditEvent.create({
      data: {
        tenantId: tenant.id,
        userId: synced.user.id,
        requestId: requestIdFromHeaders(req.headers),
        action: 'CONTACT_DELETED',
        meta: { contactId: existing.id },
      },
    })
    return true
  })
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
