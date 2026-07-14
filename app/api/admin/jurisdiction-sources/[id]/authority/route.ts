import { currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { isSuperAdmin } from '@/lib/admin-auth'
import {
  reviewJurisdictionSourceAuthority,
  sourceAuthorityReviewSchema,
} from '@/lib/jurisdiction-source-authority'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  if (!(await isSuperAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const parsed = sourceAuthorityReviewSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid authority review' }, { status: 400 })
  }

  const user = await currentUser()
  if (!user?.id) return NextResponse.json({ error: 'Reviewer identity unavailable' }, { status: 401 })

  try {
    const result = await reviewJurisdictionSourceAuthority({
      sourceId: (await params).id,
      review: parsed.data,
      reviewerId: user.id,
    })
    return NextResponse.json({
      ok: true,
      sourceId: result.sourceId,
      reviewId: result.authorityReview.id,
      status: result.authorityReview.decision,
    })
  } catch (error) {
    const code = error instanceof Error ? error.message : 'AUTHORITY_REVIEW_FAILED'
    if (code === 'SOURCE_NOT_FOUND') {
      return NextResponse.json({ error: code }, { status: 404 })
    }
    if (code === 'STALE_SOURCE') {
      return NextResponse.json({ error: code }, { status: 409 })
    }
    if (code === 'REVIEWER_REQUIRED') {
      return NextResponse.json({ error: code }, { status: 401 })
    }
    return NextResponse.json({ error: 'AUTHORITY_REVIEW_FAILED' }, { status: 500 })
  }
}
