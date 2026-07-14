import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@/app/generated/prisma'
import { db } from '@/lib/db'
import { isJurisdictionProfileSection } from '@/lib/jurisdiction-profile'
import { syncUserToDatabase } from '@/lib/sync-user'
import { requestIdFromHeaders } from '@/lib/request-correlation'

const reportSchema = z.object({
  strategy: z.string().min(1).max(40),
  section: z.string().refine(isJurisdictionProfileSection),
  fieldKey: z.string().min(1).max(80),
  label: z.string().min(1).max(120),
  reason: z.string().trim().min(3).max(2000),
})

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const synced = await syncUserToDatabase()
  if (!synced) return NextResponse.json({ error: 'Onboarding required' }, { status: 403 })

  const { id } = await params
  const body = await req.json()
  const parsed = reportSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const jurisdiction = await db.jurisdiction.findUnique({
    where: { id },
    select: { id: true, county: true, state: true },
  })
  if (!jurisdiction) return NextResponse.json({ error: 'Jurisdiction not found' }, { status: 404 })

  await db.auditEvent.create({
    data: {
      tenantId: synced.tenant.id,
      userId,
      requestId: requestIdFromHeaders(req.headers),
      action: 'JURISDICTION_PROFILE_FLAGGED',
      meta: {
        jurisdictionId: jurisdiction.id,
        jurisdiction: `${jurisdiction.county} County, ${jurisdiction.state}`,
        ...parsed.data,
      } satisfies Prisma.InputJsonValue,
    },
  })

  return NextResponse.json({ ok: true })
}
