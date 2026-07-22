import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { syncUserToDatabase } from '@/lib/sync-user'
import { requestIdFromHeaders } from '@/lib/request-correlation'

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; activityId: string }> },
) {
  const synced = await syncUserToDatabase()
  if (!synced) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { tenant } = synced
  const { id: contactId, activityId } = await params

  const deleted = await db.$transaction(async transaction => {
    const activity = await transaction.contactActivity.findFirst({
      where: { id: activityId, contactId, tenantId: tenant.id },
      select: { id: true },
    })
    if (!activity) return false

    await transaction.contactActivity.delete({ where: { id: activity.id } })
    await transaction.auditEvent.create({
      data: {
        tenantId: tenant.id,
        userId: synced.user.id,
        requestId: requestIdFromHeaders(req.headers),
        action: 'CONTACT_ACTIVITY_DELETED',
        meta: { contactId, activityId: activity.id },
      },
    })
    return true
  })
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
