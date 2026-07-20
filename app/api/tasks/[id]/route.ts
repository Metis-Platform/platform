import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { syncUserToDatabase } from '@/lib/sync-user'
import { getCurrentUser, hasRole } from '@/lib/auth'
import { requestIdFromHeaders } from '@/lib/request-correlation'

class AssigneeNotFoundError extends Error {}
class TaskNotFoundError extends Error {}

const PatchSchema = z.object({
  status:       z.enum(['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  assignedToId: z.string().min(1).nullable().optional(),
  priority:     z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  title:        z.string().min(1).max(200).optional(),
  description:  z.string().max(2000).nullable().optional(),
  dueDate:      z.string().nullable().optional(),
  taskType:     z.enum(['SEND_NOTICE', 'FILE_SUIT', 'ORDER_TITLE_SEARCH', 'RECORD_DOCUMENT',
                        'PAY_SUBSEQUENT_TAXES', 'REVIEW_REDEMPTION', 'INITIATE_FORECLOSURE',
                        'FOLLOW_UP', 'CUSTOM']).optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const synced = await syncUserToDatabase()
  if (!synced) return NextResponse.json({ error: 'Tenant not found' }, { status: 403 })
  const { tenant } = synced

  const { id } = await params
  const body = await req.json()
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const data: Record<string, unknown> = { ...parsed.data }
  if (parsed.data.status === 'COMPLETED') data.completedAt = new Date()
  else if (parsed.data.status) data.completedAt = null
  if ('dueDate' in parsed.data) {
    data.dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null
  }

  let updated
  try {
    updated = await db.$transaction(async (tx) => {
      const task = await tx.task.findFirst({
        where: { id, tenantId: tenant.id },
        select: { id: true },
      })
      if (!task) throw new TaskNotFoundError()

      if (parsed.data.assignedToId != null) {
        const assignee = await tx.user.findFirst({
          where: { id: parsed.data.assignedToId, tenantId: tenant.id },
          select: { id: true },
        })
        if (!assignee) throw new AssigneeNotFoundError()
      }

      const updatedTask = await tx.task.update({ where: { id: task.id }, data })
      await tx.auditEvent.create({
        data: {
          tenantId: tenant.id,
          userId: synced.user.id,
          requestId: requestIdFromHeaders(req.headers),
          action: 'TASK_UPDATED',
          // Task content and changed values can be investor-specific; retain identity only.
          meta: { taskId: task.id },
        },
      })
      return updatedTask
    })
  } catch (error) {
    if (error instanceof TaskNotFoundError) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (error instanceof AssigneeNotFoundError) {
      return NextResponse.json({ error: 'Assignee not found' }, { status: 404 })
    }
    throw error
  }
  return NextResponse.json(updated)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await getCurrentUser()
  if (!result) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasRole(result.user.role, 'ANALYST')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const { id } = await params
  try {
    await db.$transaction(async tx => {
      const existing = await tx.task.findFirst({
        where: { id, tenantId: result.tenant.id },
        select: { id: true },
      })
      if (!existing) throw new TaskNotFoundError()

      await tx.task.delete({ where: { id: existing.id } })
      await tx.auditEvent.create({
        data: {
          tenantId: result.tenant.id,
          userId: result.user.id,
          requestId: requestIdFromHeaders(req.headers),
          action: 'TASK_DELETED',
          meta: { taskId: existing.id },
        },
      })
    })
  } catch (error) {
    if (error instanceof TaskNotFoundError) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    throw error
  }
  return NextResponse.json({ ok: true })
}
