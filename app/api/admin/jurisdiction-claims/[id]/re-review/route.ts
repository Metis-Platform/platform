import { currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { isSuperAdmin } from '@/lib/admin-auth'
import { reReviewJurisdictionClaim } from '@/lib/jurisdiction-claim-re-review'

const schema = z.object({
  evidenceSnapshotId: z.string().min(1),
  expectedFreshnessUpdatedAt: z.string().datetime(),
  explanation: z.string().trim().min(10).max(2000),
}).strict()

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (!(await isSuperAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const user = await currentUser()
  if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  try {
    const result = await reReviewJurisdictionClaim({
      claimId: id,
      evidenceSnapshotId: parsed.data.evidenceSnapshotId,
      expectedFreshnessUpdatedAt: new Date(parsed.data.expectedFreshnessUpdatedAt),
      explanation: parsed.data.explanation,
      reviewerId: user.id,
    })
    return NextResponse.json({
      ok: true,
      reReviewId: result.reReviewId,
      freshness: {
        lastEvidenceRetrievedAt: result.freshness.lastEvidenceRetrievedAt.toISOString(),
        reviewDueAt: result.freshness.reviewDueAt.toISOString(),
        staleAt: result.freshness.staleAt.toISOString(),
        policyVersion: result.freshness.policyVersion,
      },
    })
  } catch (error) {
    const code = error instanceof Error ? error.message : 'RE_REVIEW_FAILED'
    if (code === 'CLAIM_NOT_FOUND') {
      return NextResponse.json({ error: code }, { status: 404 })
    }
    if (
      code === 'STALE_CLAIM_REVIEW' ||
      code === 'CLAIM_SUPERSEDED' ||
      code === 'CLAIM_NOT_CURRENT'
    ) {
      return NextResponse.json({ error: code }, { status: 409 })
    }
    if (
      code === 'EVIDENCE_SNAPSHOT_NOT_NEWER' ||
      code === 'EVIDENCE_CHANGED_REVIEW_REQUIRED' ||
      code === 'EVIDENCE_RETRIEVED_AT_INVALID' ||
      code === 'SOURCE_REJECTED' ||
      code === 'CLAIM_RISK_UNCLASSIFIED' ||
      code === 'CLAIM_VOLATILITY_UNCLASSIFIED'
    ) {
      return NextResponse.json({ error: code }, { status: 422 })
    }
    return NextResponse.json({ error: code }, { status: 400 })
  }
}
