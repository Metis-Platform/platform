import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { syncUserToDatabase } from '@/lib/sync-user'
import { requestIdFromHeaders } from '@/lib/request-correlation'

class AssigneeNotFoundError extends Error {}

const CreateSchema = z.object({
  dealId:      z.string().min(1),
  title:       z.string().min(1, 'Title is required').max(200),
  description: z.string().max(2000).optional(),
  taskType:    z.enum(['SEND_NOTICE', 'FILE_SUIT', 'ORDER_TITLE_SEARCH', 'RECORD_DOCUMENT',
                       'PAY_SUBSEQUENT_TAXES', 'REVIEW_REDEMPTION', 'INITIATE_FORECLOSURE',
                       'FOLLOW_UP', 'CUSTOM']).default('CUSTOM'),
  priority:    z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  dueDate:     z.string().optional(),
  assignedToId: z.string().min(1).optional(),
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

  let task
  try {
    task = await db.$transaction(async (tx) => {
      if (assignedToId != null) {
        const assignee = await tx.user.findFirst({
          where: { id: assignedToId, tenantId: tenant.id },
          select: { id: true },
        })
        if (!assignee) throw new AssigneeNotFoundError()
      }

      const created = await tx.task.create({
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
      await tx.auditEvent.create({
        data: {
          tenantId: tenant.id,
          userId: synced.user.id,
          requestId: requestIdFromHeaders(req.headers),
          action: 'TASK_CREATED',
          // Task content and assignment can be investor-specific; retain identity only.
          meta: { taskId: created.id, dealId },
        },
      })
      return created
    })
  } catch (error) {
    if (error instanceof AssigneeNotFoundError) {
      return NextResponse.json({ error: 'Assignee not found' }, { status: 404 })
    }
    throw error
  }

  return NextResponse.json(task, { status: 201 })
}
