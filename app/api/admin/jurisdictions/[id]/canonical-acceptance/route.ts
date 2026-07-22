import { NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { z } from 'zod'
import { isSuperAdmin } from '@/lib/admin-auth'
import { publishCanonicalAcceptance } from '@/lib/jurisdiction-canonical-acceptance'
import { requestIdFromHeaders } from '@/lib/request-correlation'
import { syncUserToDatabase } from '@/lib/sync-user'

const schema = z.object({
  contractVersion: z.string().trim().min(3).max(120),
  caseReference: z.string().trim().min(3).max(500),
  evidenceUrl: z.string().url().max(2000),
  result: z.enum(['PASSED', 'FAILED']),
  summary: z.string().trim().min(10).max(4000),
  replacesAcceptanceId: z.string().cuid().optional(),
}).strict()

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isSuperAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  const user = await currentUser()
  if (!user?.id) return NextResponse.json({ error: 'Reviewer identity unavailable' }, { status: 401 })
  const actor = await syncUserToDatabase()
  if (!actor) return NextResponse.json({ error: 'Active organization required' }, { status: 401 })
  const { id: jurisdictionId } = await params

  try {
    const result = await publishCanonicalAcceptance({
      jurisdictionId,
      ...parsed.data,
      reviewerId: user.id,
      auditEvent: {
        tenantId: actor.tenant.id,
        userId: actor.user.id,
        requestId: requestIdFromHeaders(req.headers),
        action: 'JURISDICTION_CANONICAL_ACCEPTANCE_RECORDED',
        meta: { jurisdictionId, result: parsed.data.result, contractVersion: parsed.data.contractVersion },
      },
    })
    return NextResponse.json({ ok: true, ...result }, { status: 201 })
  } catch (error) {
    const code = error instanceof Error ? error.message : 'CANONICAL_ACCEPTANCE_FAILED'
    return NextResponse.json({ error: code }, { status: 409 })
  }
}
