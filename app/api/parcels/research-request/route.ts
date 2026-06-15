import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { syncUserToDatabase } from '@/lib/sync-user'
import { normalizeApn } from '@/lib/parcel/apn'

const requestSchema = z.object({
  dealId: z.string().min(1),
  priority: z.enum(['STANDARD', 'RUSH']).default('STANDARD'),
})

export async function POST(req: NextRequest) {
  const synced = await syncUserToDatabase()
  if (!synced) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = requestSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const deal = await db.deal.findUnique({
    where: { id: parsed.data.dealId, tenantId: synced.tenant.id },
    select: {
      id: true,
      property: {
        select: {
          apn: true,
          jurisdiction: { select: { fips: true } },
        },
      },
    },
  })
  const fipsCounty = deal?.property.jurisdiction.fips
  if (!deal || !fipsCounty) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })

  const existing = await db.parcelResearchRequest.findFirst({
    where: {
      tenantId: synced.tenant.id,
      dealId: deal.id,
      status: { in: ['PENDING', 'IN_PROGRESS'] },
    },
    select: { id: true, status: true },
  })
  if (existing) return NextResponse.json({ request: existing }, { status: 200 })

  const normalized = normalizeApn(deal.property.apn, fipsCounty)
  const request = await db.parcelResearchRequest.create({
    data: {
      tenantId: synced.tenant.id,
      dealId: deal.id,
      apnNormalized: normalized.normalized,
      fipsCounty: normalized.fipsCounty,
      status: 'PENDING',
      priority: parsed.data.priority,
    },
  })

  return NextResponse.json({ request }, { status: 201 })
}
