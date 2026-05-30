import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { isSuperAdmin } from '@/lib/admin-auth'

const schema = z.object({
  plan: z.enum(['STARTER', 'PROFESSIONAL', 'TEAM', 'ENTERPRISE']),
})

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isSuperAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })

  const tenant = await db.tenant.findUnique({ where: { id } })
  if (!tenant) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updated = await db.tenant.update({ where: { id }, data: { plan: parsed.data.plan } })
  return NextResponse.json(updated)
}
