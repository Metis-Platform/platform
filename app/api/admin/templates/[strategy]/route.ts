import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { isSuperAdmin } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import { StrategyType, Prisma } from '@/app/generated/prisma'

const ItemSchema = z.object({
  key: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  taskType: z.string(),
  defaultPriority: z.string(),
  dueAnchor: z.string().optional(),
  dueOffsetDays: z.number().int().optional(),
})

const PatchSchema = z.object({
  name: z.string().min(1).optional(),
  items: z.array(ItemSchema).optional(),
  isActive: z.boolean().optional(),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ strategy: string }> },
): Promise<NextResponse> {
  if (!(await isSuperAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { strategy } = await params
  const tpl = await db.checklistTemplate.findFirst({
    where: { strategy: strategy as StrategyType, tenantId: null },
  })
  if (!tpl) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(tpl)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ strategy: string }> },
): Promise<NextResponse> {
  if (!(await isSuperAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { strategy } = await params
  const body = await req.json()
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const tpl = await db.checklistTemplate.findFirst({
    where: { strategy: strategy as StrategyType, tenantId: null },
  })
  if (!tpl) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updated = await db.checklistTemplate.update({
    where: { id: tpl.id },
    data: {
      ...(parsed.data.name !== undefined && { name: parsed.data.name }),
      ...(parsed.data.items !== undefined && { items: parsed.data.items as unknown as Prisma.InputJsonValue }),
      ...(parsed.data.isActive !== undefined && { isActive: parsed.data.isActive }),
      version: { increment: 1 },
    },
  })

  return NextResponse.json(updated)
}
