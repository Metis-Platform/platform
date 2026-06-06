import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentUser, hasRole } from '@/lib/auth'

const CommentSchema = z.object({
  body: z.string().trim().min(1).max(2000),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await getCurrentUser()
  if (!result) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasRole(result.user.role, 'ASSISTANT')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const { id } = await params
  const task = await db.task.findUnique({ where: { id }, select: { id: true, tenantId: true } })
  if (!task || task.tenantId !== result.tenant.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = CommentSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const comment = await db.taskComment.create({
    data: {
      taskId: task.id,
      userId: result.user.id,
      body: parsed.data.body,
    },
    include: { user: { select: { id: true, name: true, email: true } } },
  })

  return NextResponse.json({
    id: comment.id,
    body: comment.body,
    createdAt: comment.createdAt.toISOString(),
    user: comment.user,
  })
}
