import { NextResponse } from 'next/server'
import { syncUserToDatabase } from '@/lib/sync-user'
import { db } from '@/lib/db'

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const synced = await syncUserToDatabase()
  if (!synced) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const jurisdiction = await db.jurisdiction.findUnique({ where: { id }, select: { id: true } })
  if (!jurisdiction) return NextResponse.json({ error: 'Jurisdiction not found' }, { status: 404 })

  const result = await db.$transaction(async tx => {
    const work = await tx.jurisdictionResearchWork.upsert({
      where: { jurisdictionId: id },
      create: { jurisdictionId: id, startedAt: new Date() },
      update: {},
      select: { id: true, status: true, requestedAt: true },
    })
    const demand = await tx.jurisdictionResearchDemand.upsert({
      where: { jurisdictionId_tenantId: { jurisdictionId: id, tenantId: synced.tenant.id } },
      create: { jurisdictionId: id, tenantId: synced.tenant.id, requestedBy: synced.user.id },
      update: {},
      select: { id: true, requestedAt: true },
    })
    return { work, demand }
  })
  return NextResponse.json(result, { status: 201 })
}
