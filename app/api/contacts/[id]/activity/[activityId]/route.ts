import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { syncUserToDatabase } from '@/lib/sync-user'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; activityId: string }> },
) {
  const synced = await syncUserToDatabase()
  if (!synced) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { tenant } = synced
  const { id: contactId, activityId } = await params

  const activity = await db.contactActivity.findUnique({
    where: { id: activityId, tenantId: tenant.id },
  })
  if (!activity || activity.contactId !== contactId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await db.contactActivity.delete({ where: { id: activityId } })
  return NextResponse.json({ ok: true })
}
