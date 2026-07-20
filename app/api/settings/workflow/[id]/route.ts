import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { requestIdFromHeaders } from '@/lib/request-correlation'

const patchSchema = z.object({
  isActive: z.boolean().optional(),
  name: z.string().min(1).max(100).optional(),
})

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const result = await getCurrentUser()
  if (!result) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const updated = await db.$transaction(async tx => {
    const rule = await tx.tenantWorkflowRule.findFirst({ where: { id, tenantId: result.tenant.id } })
    if (!rule) return null

    const changed = await tx.tenantWorkflowRule.update({ where: { id }, data: parsed.data })
    await tx.auditEvent.create({
      data: {
        tenantId: result.tenant.id,
        userId: result.user.id,
        requestId: requestIdFromHeaders(req.headers),
        action: 'WORKFLOW_RULE_UPDATED',
        meta: { workflowRuleId: id, isActive: changed.isActive },
      },
    })
    return changed
  })
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(updated)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const result = await getCurrentUser()
  if (!result) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const deleted = await db.$transaction(async tx => {
    const rule = await tx.tenantWorkflowRule.findFirst({ where: { id, tenantId: result.tenant.id } })
    if (!rule) return false

    await tx.tenantWorkflowRule.delete({ where: { id } })
    await tx.auditEvent.create({
      data: {
        tenantId: result.tenant.id,
        userId: result.user.id,
        requestId: requestIdFromHeaders(req.headers),
        action: 'WORKFLOW_RULE_DELETED',
        meta: { workflowRuleId: id, strategy: rule.strategy },
      },
    })
    return true
  })
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
