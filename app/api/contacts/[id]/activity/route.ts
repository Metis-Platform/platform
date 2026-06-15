import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { syncUserToDatabase } from '@/lib/sync-user'

const createSchema = z.object({
  type: z.enum(['NOTE','CALL','EMAIL','TEXT','MEETING','OFFER_SENT','CONTRACT_SENT','OTHER']),
  notes: z.string().max(5000).optional().nullable(),
  occurredAt: z.string().datetime().optional(),
})

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const synced = await syncUserToDatabase()
  if (!synced) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { tenant } = synced
  const { id: contactId } = await params

  const contact = await db.contact.findUnique({ where: { id: contactId, tenantId: tenant.id } })
  if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 })

  const parsed = createSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { type, notes, occurredAt } = parsed.data
  const activity = await db.contactActivity.create({
    data: {
      contactId,
      tenantId: tenant.id,
      type,
      notes: notes ?? null,
      occurredAt: occurredAt ? new Date(occurredAt) : new Date(),
    },
  })

  return NextResponse.json({ activity }, { status: 201 })
}
