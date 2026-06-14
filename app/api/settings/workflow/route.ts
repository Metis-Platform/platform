import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { auth } from '@clerk/nextjs/server'
import { StrategyType, Prisma } from '@/app/generated/prisma'

const createSchema = z.object({
  strategy: z.nativeEnum(StrategyType),
  name: z.string().min(1).max(100),
  triggerEvent: z.string().min(1),
  offsetDays: z.number().int(),
  action: z.string().default('CREATE_TASK'),
  actionConfig: z.record(z.string(), z.unknown()),
})

async function getTenant() {
  const { orgId } = await auth()
  if (!orgId) return null
  return db.tenant.findUnique({ where: { clerkOrgId: orgId }, select: { id: true } })
}

export async function GET() {
  const tenant = await getTenant()
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const rules = await db.tenantWorkflowRule.findMany({
    where: { tenantId: tenant.id },
    orderBy: [{ strategy: 'asc' }, { createdAt: 'asc' }],
  })
  return NextResponse.json(rules)
}

export async function POST(req: Request) {
  const tenant = await getTenant()
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const rule = await db.tenantWorkflowRule.create({
    data: {
      tenantId: tenant.id,
      strategy: parsed.data.strategy,
      name: parsed.data.name,
      triggerEvent: parsed.data.triggerEvent,
      offsetDays: parsed.data.offsetDays,
      action: parsed.data.action,
      actionConfig: parsed.data.actionConfig as Prisma.InputJsonValue,
    },
  })
  return NextResponse.json(rule)
}
