import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { syncUserToDatabase } from '@/lib/sync-user'
import { db } from '@/lib/db'
import { deleteObject } from '@/lib/r2'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const synced = await syncUserToDatabase()
  if (!synced) return NextResponse.json({ error: 'Tenant not found' }, { status: 403 })
  const { tenant } = synced

  const { id } = await params
  const doc = await db.document.findUnique({ where: { id } })
  if (!doc || doc.tenantId !== tenant.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Delete from R2 first, then DB — if R2 fails we won't have an orphan DB record
  await deleteObject(doc.r2Key)
  await db.document.delete({ where: { id } })

  return new NextResponse(null, { status: 204 })
}
