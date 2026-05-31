import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { syncUserToDatabase } from '@/lib/sync-user'

const CreateSchema = z.object({
  dealId:      z.string().min(1),
  title:       z.string().min(1, 'Title is required').max(200),
  description: z.string().max(2000).optional(),
  taskType:    z.enum(['SEND_NOTICE', 'FILE_SUIT', 'ORDER_TITLE_SEARCH', 'RECORD_DOCUMENT',
                       'PAY_SUBSEQUENT_TAXES', 'REVIEW_REDEMPTION', 'INITIATE_FORECLOSURE',
                       'FOLLOW_UP', 'CUSTOM']).default('CUSTOM'),
  priority:    z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  dueDate:     z.string().optional(),
  assignedToId: z.string().optional(),
})

export async function POST(req: Request) {
  const synced = await syncUserToDatabase()
  if (!synced) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { tenant } = synced

  const body = await req.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { dealId, title, description, taskType, priority, dueDate, assignedToId } = parsed.data

  // Verify deal belongs to this tenant
  const deal = await db.deal.findUnique({ where: { id: dealId } })
  if (!deal || deal.tenantId !== tenant.id) {
    return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
  }

  const task = await db.task.create({
    data: {
      dealId,
      tenantId: tenant.id,
      title,
      description: description ?? null,
      taskType,
      priority,
      dueDate: dueDate ? new Date(dueDate) : null,
      assignedToId: assignedToId ?? null,
      status: 'OPEN',
    },
    include: { assignedTo: { select: { id: true, name: true, email: true } } },
  })

  return NextResponse.json(task, { status: 201 })
}
