import { NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { z } from 'zod'
import { isSuperAdmin } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import { publishJurisdictionClaim } from '@/lib/jurisdiction-claim-publication'
import { getJurisdictionQuestion, COUNTY_LAND_USE_AUTHORITY_SCOPE_FIELD } from '@/lib/jurisdiction-question-library'

const schema = z.object({
  sourceUrlId: z.string().min(1),
  scope: z.enum(['COUNTY_WIDE', 'UNINCORPORATED_COUNTY']),
  citation: z.string().trim().min(10).max(4000),
}).strict()

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isSuperAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  const user = await currentUser()
  if (!user?.id) return NextResponse.json({ error: 'Reviewer identity unavailable' }, { status: 401 })
  const { id: jurisdictionId } = await params

  const source = await db.jurisdictionSourceUrl.findFirst({
    where: {
      id: parsed.data.sourceUrlId,
      jurisdictionId,
      authorityStatus: 'VERIFIED',
      authorityClass: 'LOCAL_OFFICIAL',
    },
    select: {
      id: true, url: true, authorityClass: true, authorityOwner: true, authorityStatus: true,
      authorityVerifiedAt: true, authorityVerifiedBy: true,
      evidenceSnapshots: {
        orderBy: { retrievedAt: 'desc' },
        take: 1,
        select: {
          id: true, sourceUrl: true, retrievedAt: true, contentHash: true, storageKey: true,
          retrievalAdapter: true, representationMediaType: true, byteLength: true,
        },
      },
    },
  })
  if (!source) return NextResponse.json({ error: 'VERIFIED_LOCAL_SOURCE_REQUIRED' }, { status: 422 })
  const snapshot = source.evidenceSnapshots[0]
  if (!snapshot) return NextResponse.json({ error: 'EVIDENCE_SNAPSHOT_REQUIRED' }, { status: 422 })
  const question = getJurisdictionQuestion('zoning', COUNTY_LAND_USE_AUTHORITY_SCOPE_FIELD)
  if (!question) return NextResponse.json({ error: 'AUTHORITY_SCOPE_QUESTION_UNAVAILABLE' }, { status: 500 })

  try {
    const result = await publishJurisdictionClaim({
      jurisdictionId,
      section: 'zoning',
      fieldKey: COUNTY_LAND_USE_AUTHORITY_SCOPE_FIELD,
      extractedValue: {
        value: parsed.data.scope,
        geographicScope: parsed.data.scope,
        confidence: 1,
      },
      question,
      reviewerId: user.id,
      reviewerLabel: user.id,
      source: {
        sourceUrlId: source.id,
        url: snapshot.sourceUrl,
        snippet: parsed.data.citation,
        retrievedAt: snapshot.retrievedAt,
        contentHash: snapshot.contentHash,
        evidenceSnapshotId: snapshot.id,
        storageKey: snapshot.storageKey,
        retrievalAdapter: snapshot.retrievalAdapter,
        representationMediaType: snapshot.representationMediaType,
        byteLength: snapshot.byteLength,
        authorityClass: source.authorityClass,
        authorityOwner: source.authorityOwner,
        authorityStatus: source.authorityStatus,
        authorityVerifiedAt: source.authorityVerifiedAt,
        authorityVerifiedBy: source.authorityVerifiedBy,
      },
    })
    return NextResponse.json({ ok: true, claimId: result.claimId }, { status: 201 })
  } catch (error) {
    const code = error instanceof Error ? error.message : 'AUTHORITY_SCOPE_PUBLICATION_FAILED'
    return NextResponse.json({ error: code }, { status: 409 })
  }
}
