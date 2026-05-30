import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { syncUserToDatabase } from '@/lib/sync-user'
import { db } from '@/lib/db'
import { getDownloadUrl } from '@/lib/r2'

export async function GET(
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

  const url = await getDownloadUrl(doc.r2Key, doc.fileName)
  return NextResponse.redirect(url)
}
