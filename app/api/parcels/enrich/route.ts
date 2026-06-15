import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { syncUserToDatabase } from '@/lib/sync-user'
import { normalizeApn } from '@/lib/parcel/apn'
import { enrichParcel } from '@/lib/parcel/enrich'

const enrichSchema = z.object({
  dealId: z.string().min(1).optional(),
  apn: z.string().min(1).max(80).optional(),
  fipsCounty: z.string().regex(/^\d{5}$/).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lon: z.number().min(-180).max(180).optional(),
}).refine(value => value.dealId || (value.apn && value.fipsCounty), {
  message: 'Provide dealId or apn plus fipsCounty',
})

const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_REQUESTS = 10
const RATE_LIMIT_ACTION = 'PARCEL_ENRICH_REQUEST'

export async function POST(req: Request) {
  const synced = await syncUserToDatabase()
  if (!synced) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { tenant } = synced
  if (await isRateLimited(tenant.id)) {
    return NextResponse.json({ error: 'Too many parcel enrichment requests. Try again shortly.' }, { status: 429 })
  }

  const parsed = enrichSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const resolved = parsed.data.dealId
    ? await resolveDealParcel(parsed.data.dealId, tenant.id)
    : {
        apn: parsed.data.apn!,
        fipsCounty: parsed.data.fipsCounty!,
      }

  if (!resolved) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })

  const apn = normalizeApn(resolved.apn, resolved.fipsCounty)
  await db.auditEvent.create({
    data: {
      tenantId: tenant.id,
      userId: synced.user.id,
      action: RATE_LIMIT_ACTION,
      meta: { apn: apn.normalized, fipsCounty: apn.fipsCounty },
    },
  })
  const result = await enrichParcel(apn.normalized, apn.fipsCounty, parsed.data.lat, parsed.data.lon, tenant.id)

  return NextResponse.json({
    status: 'accepted',
    apn,
    ...result,
  }, { status: 202 })
}

async function resolveDealParcel(dealId: string, tenantId: string): Promise<{ apn: string; fipsCounty: string } | null> {
  const deal = await db.deal.findUnique({
    where: { id: dealId, tenantId },
    select: {
      property: {
        select: {
          apn: true,
          jurisdiction: { select: { fips: true } },
        },
      },
    },
  })

  const fipsCounty = deal?.property.jurisdiction.fips
  if (!deal || !fipsCounty) return null
  return { apn: deal.property.apn, fipsCounty }
}

async function isRateLimited(tenantId: string): Promise<boolean> {
  const recentCount = await db.auditEvent.count({
    where: {
      tenantId,
      action: RATE_LIMIT_ACTION,
      createdAt: { gte: new Date(Date.now() - RATE_LIMIT_WINDOW_MS) },
    },
  })

  return recentCount >= RATE_LIMIT_MAX_REQUESTS
}
