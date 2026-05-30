import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentUser, hasRole } from '@/lib/auth'

const schema = z.object({
  role: z.enum(['OWNER', 'ANALYST', 'ATTORNEY', 'ASSISTANT', 'READ_ONLY']),
})

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await getCurrentUser()
  if (!result) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasRole(result.user.role, 'OWNER')) {
    return NextResponse.json({ error: 'Only owners can change roles' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid role' }, { status: 400 })

  // Ensure target user belongs to same tenant
  const target = await db.user.findUnique({ where: { id } })
  if (!target || target.tenantId !== result.tenant.id) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const updated = await db.user.update({ where: { id }, data: { role: parsed.data.role } })
  return NextResponse.json(updated)
}
