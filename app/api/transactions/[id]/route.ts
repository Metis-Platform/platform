import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, hasRole } from '@/lib/auth'
import { requestIdFromHeaders } from '@/lib/request-correlation'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await getCurrentUser()
  if (!result) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasRole(result.user.role, 'ANALYST')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const { id } = await params
  const deleted = await db.$transaction(async transaction => {
    const existing = await transaction.financialTransaction.findFirst({
      where: { id, tenantId: result.tenant.id },
      select: { id: true, dealId: true },
    })
    if (!existing) return false

    await transaction.financialTransaction.delete({ where: { id: existing.id } })
    await transaction.auditEvent.create({
      data: {
        tenantId: result.tenant.id,
        userId: result.user.id,
        requestId: requestIdFromHeaders(req.headers),
        action: 'FINANCIAL_TRANSACTION_DELETED',
        meta: { transactionId: existing.id, dealId: existing.dealId },
      },
    })
    return true
  })
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return new NextResponse(null, { status: 204 })
}
