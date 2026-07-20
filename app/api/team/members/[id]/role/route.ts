import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentUser, hasRole } from '@/lib/auth'
import { requestIdFromHeaders } from '@/lib/request-correlation'

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

  const updated = await db.$transaction(async tx => {
    // Ensure target user belongs to the same tenant before changing access.
    const target = await tx.user.findUnique({ where: { id } })
    if (!target || target.tenantId !== result.tenant.id) return null

    const changed = await tx.user.update({ where: { id }, data: { role: parsed.data.role } })
    await tx.auditEvent.create({
      data: {
        tenantId: result.tenant.id,
        userId: result.user.id,
        requestId: requestIdFromHeaders(req.headers),
        action: 'TEAM_MEMBER_ROLE_CHANGED',
        meta: { memberId: id, role: parsed.data.role },
      },
    })
    return changed
  })
  if (!updated) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  return NextResponse.json(updated)
}
