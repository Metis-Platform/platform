import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { isSuperAdmin } from '@/lib/admin-auth'
import { StrategyType, ModuleTier } from '@/app/generated/prisma'

const upsertSchema = z.object({
  strategy: z.nativeEnum(StrategyType),
  tier: z.nativeEnum(ModuleTier).default('STANDARD'),
})

const removeSchema = z.object({
  strategy: z.nativeEnum(StrategyType),
})

// GET /api/admin/tenants/[id]/modules — list all modules for a tenant
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isSuperAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const modules = await db.tenantModule.findMany({
    where: { tenantId: id },
    orderBy: { strategy: 'asc' },
  })
  return NextResponse.json(modules)
}

// POST /api/admin/tenants/[id]/modules — grant or upgrade a module
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isSuperAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const body = await req.json()
  const parsed = upsertSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const tenant = await db.tenant.findUnique({ where: { id }, select: { id: true } })
  if (!tenant) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const module_ = await db.tenantModule.upsert({
    where: { tenantId_strategy: { tenantId: id, strategy: parsed.data.strategy } },
    update: { tier: parsed.data.tier },
    create: { tenantId: id, strategy: parsed.data.strategy, tier: parsed.data.tier },
  })
  return NextResponse.json(module_)
}

// DELETE /api/admin/tenants/[id]/modules — revoke a module
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isSuperAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const body = await req.json()
  const parsed = removeSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  await db.tenantModule.deleteMany({
    where: { tenantId: id, strategy: parsed.data.strategy },
  })
  return NextResponse.json({ ok: true })
}
