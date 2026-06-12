import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, hasRole } from '@/lib/auth'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await getCurrentUser()
  if (!result) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasRole(result.user.role, 'ANALYST')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const { id } = await params
  const tx = await db.financialTransaction.findUnique({ where: { id } })
  if (!tx || tx.tenantId !== result.tenant.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await db.financialTransaction.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
