import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { syncUserToDatabase } from '@/lib/sync-user'

const investorProfileSchema = z.object({
  maxPurchasePrice: z.number().positive().optional(),
  improvementCapital: z.number().nonnegative().optional(),
  holdMonthsTolerance: z.number().int().nonnegative().optional(),
  targetRoi: z.number().nonnegative().optional(),
  financing: z.enum(['CASH', 'LENDER']).default('CASH'),
  licenseTypes: z.array(z.string()).default([]),
})

export async function GET() {
  const synced = await syncUserToDatabase()
  if (!synced) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await db.investorProfile.findUnique({
    where: { tenantId: synced.tenant.id },
  })
  return NextResponse.json({ profile })
}

export async function POST(req: NextRequest) {
  const synced = await syncUserToDatabase()
  if (!synced) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = investorProfileSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const profile = await db.investorProfile.upsert({
    where: { tenantId: synced.tenant.id },
    create: {
      tenantId: synced.tenant.id,
      ...parsed.data,
    },
    update: parsed.data,
  })

  return NextResponse.json({ profile })
}
