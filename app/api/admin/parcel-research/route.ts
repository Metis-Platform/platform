import { NextRequest, NextResponse } from 'next/server'
import { isSuperAdmin } from '@/lib/admin-auth'
import { db } from '@/lib/db'

const VALID_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETE', 'CANCELLED'] as const

export async function GET(req: NextRequest) {
  if (!(await isSuperAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const status = req.nextUrl.searchParams.get('status') ?? 'PENDING'
  const statusFilter = VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])
    ? status
    : 'PENDING'

  const requests = await db.parcelResearchRequest.findMany({
    where: { status: statusFilter },
    include: {
      tenant: { select: { id: true, name: true } },
      deal: {
        select: {
          id: true,
          strategyType: true,
          property: {
            select: {
              apn: true,
              state: true,
              jurisdiction: { select: { county: true, state: true } },
            },
          },
        },
      },
    },
    orderBy: [
      { priority: 'desc' },
      { requestedAt: 'asc' },
    ],
    take: 100,
  })

  return NextResponse.json({ requests })
}
