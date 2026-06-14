import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { auth } from '@clerk/nextjs/server'

const patchSchema = z.object({
  isActive: z.boolean().optional(),
  name: z.string().min(1).max(100).optional(),
})

async function getTenantId() {
  const { orgId } = await auth()
  if (!orgId) return null
  const t = await db.tenant.findUnique({ where: { clerkOrgId: orgId }, select: { id: true } })
  return t?.id ?? null
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = await getTenantId()
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const rule = await db.tenantWorkflowRule.findFirst({ where: { id, tenantId } })
  if (!rule) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updated = await db.tenantWorkflowRule.update({ where: { id }, data: parsed.data })
  return NextResponse.json(updated)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = await getTenantId()
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const rule = await db.tenantWorkflowRule.findFirst({ where: { id, tenantId } })
  if (!rule) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.tenantWorkflowRule.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
