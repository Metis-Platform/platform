import { NextResponse } from 'next/server'
import { isSuperAdmin } from '@/lib/admin-auth'
import { db } from '@/lib/db'

export async function GET(req: Request): Promise<NextResponse> {
  if (!(await isSuperAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const url = new URL(req.url)
  const status = url.searchParams.get('status') ?? 'PENDING'
  const section = url.searchParams.get('section') ?? undefined
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 100), 200)

  const candidates = await db.extractionCandidate.findMany({
    where: {
      status: status as 'PENDING' | 'APPROVED' | 'REJECTED',
      ...(section ? { section } : {}),
    },
    include: {
      jurisdiction: { select: { county: true, state: true } },
      sourceUrl: { select: { url: true, officeType: true } },
    },
    orderBy: [{ confidence: 'desc' }, { createdAt: 'asc' }],
    take: limit,
  })

  const pendingCount = await db.extractionCandidate.count({ where: { status: 'PENDING' } })

  return NextResponse.json({ candidates, pendingCount })
}
