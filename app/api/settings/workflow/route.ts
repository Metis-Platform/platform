import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentUser, hasRole } from '@/lib/auth'
import { requestIdFromHeaders } from '@/lib/request-correlation'
import { StrategyType, Prisma } from '@/app/generated/prisma'

const createSchema = z.object({
  strategy: z.nativeEnum(StrategyType),
  name: z.string().min(1).max(100),
  triggerEvent: z.string().min(1),
  offsetDays: z.number().int(),
  action: z.string().default('CREATE_TASK'),
  actionConfig: z.record(z.string(), z.unknown()),
})

export async function GET() {
  const result = await getCurrentUser()
  if (!result) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasRole(result.user.role, 'OWNER')) {
    return NextResponse.json({ error: 'Only owners can manage workflow rules' }, { status: 403 })
  }
  const rules = await db.tenantWorkflowRule.findMany({
    where: { tenantId: result.tenant.id },
    orderBy: [{ strategy: 'asc' }, { createdAt: 'asc' }],
  })
  return NextResponse.json(rules)
}

export async function POST(req: Request) {
  const result = await getCurrentUser()
  if (!result) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasRole(result.user.role, 'OWNER')) {
    return NextResponse.json({ error: 'Only owners can manage workflow rules' }, { status: 403 })
  }
  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const rule = await db.$transaction(async tx => {
    const created = await tx.tenantWorkflowRule.create({
      data: {
        tenantId: result.tenant.id,
        strategy: parsed.data.strategy,
        name: parsed.data.name,
        triggerEvent: parsed.data.triggerEvent,
        offsetDays: parsed.data.offsetDays,
        action: parsed.data.action,
        actionConfig: parsed.data.actionConfig as Prisma.InputJsonValue,
      },
    })
    await tx.auditEvent.create({
      data: {
        tenantId: result.tenant.id,
        userId: result.user.id,
        requestId: requestIdFromHeaders(req.headers),
        action: 'WORKFLOW_RULE_CREATED',
        meta: { workflowRuleId: created.id, strategy: created.strategy },
      },
    })
    return created
  })
  return NextResponse.json(rule)
}
