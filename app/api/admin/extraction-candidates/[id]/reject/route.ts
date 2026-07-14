import { NextResponse } from 'next/server'
import { z } from 'zod'
import { currentUser } from '@clerk/nextjs/server'
import { isSuperAdmin } from '@/lib/admin-auth'
import { rejectJurisdictionCandidate } from '@/lib/jurisdiction-claim-contradiction-review'

const schema = z.object({
  expectedCandidateUpdatedAt: z.string().datetime(),
  contradiction: z.object({
    expectedCurrentClaimId: z.string().min(1),
    decision: z.enum(['REJECTED_CHALLENGE', 'NOT_COMPARABLE']),
    explanation: z.string().trim().min(10).max(2000),
  }).strict().optional(),
}).strict()

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (!(await isSuperAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const user = await currentUser()
  if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const reviewerLabel = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId)
    ?.emailAddress ?? user.id

  try {
    const result = await rejectJurisdictionCandidate({
      candidateId: id,
      expectedCandidateUpdatedAt: new Date(parsed.data.expectedCandidateUpdatedAt),
      expectedCurrentClaimId: parsed.data.contradiction?.expectedCurrentClaimId,
      decision: parsed.data.contradiction?.decision,
      explanation: parsed.data.contradiction?.explanation,
      reviewerId: user.id,
      reviewerLabel,
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    const code = error instanceof Error ? error.message : 'CANDIDATE_REJECTION_FAILED'
    const status = code === 'CANDIDATE_NOT_PENDING' || code === 'STALE_CLAIM_CONTRADICTION'
      ? 409
      : 422
    return NextResponse.json({ error: code }, { status })
  }
}
