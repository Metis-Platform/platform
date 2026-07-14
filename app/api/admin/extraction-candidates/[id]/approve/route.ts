import { NextResponse } from 'next/server'
import { z } from 'zod'
import { currentUser } from '@clerk/nextjs/server'
import { isSuperAdmin } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import { isJurisdictionProfileSection } from '@/lib/jurisdiction-profile'
import { publishJurisdictionClaim } from '@/lib/jurisdiction-claim-publication'
import { evaluateJurisdictionPublication } from '@/lib/jurisdiction-publication-policy'

const schema = z.object({
  value: z.unknown().optional(),
  contradiction: z.object({
    expectedCurrentClaimId: z.string().min(1),
    expectedCandidateUpdatedAt: z.string().datetime(),
    explanation: z.string().trim().min(10).max(2000),
  }).strict().optional(),
}).strict()

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (!(await isSuperAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const candidate = await db.extractionCandidate.findUnique({
    where: { id },
    include: {
      jurisdiction: { select: { county: true, state: true } },
      sourceUrl: {
        select: {
          url: true,
          authorityClass: true,
          authorityOwner: true,
          authorityStatus: true,
          authorityVerifiedAt: true,
          authorityVerifiedBy: true,
        },
      },
    },
  })
  if (!candidate) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (candidate.status !== 'PENDING') {
    return NextResponse.json({ error: 'Candidate is not pending' }, { status: 409 })
  }

  if (!isJurisdictionProfileSection(candidate.section)) {
    return NextResponse.json({ error: 'Invalid profile section' }, { status: 400 })
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  const body = parsed.data

  // If the reviewer edited the value, merge it into the extracted field
  const extractedValue = candidate.extractedValue as Record<string, unknown>
  const proposedField = body.value !== undefined
    ? { ...extractedValue, value: body.value }
    : extractedValue

  const user = await currentUser()
  const reviewerId = user?.id ?? ''
  const reviewerLabel = user?.emailAddresses.find(e => e.id === user.primaryEmailAddressId)
    ?.emailAddress ?? reviewerId
  const decision = evaluateJurisdictionPublication({
    section: candidate.section,
    fieldKey: candidate.fieldKey,
    mode: 'HUMAN_SINGLE',
    evidence: {
      sourceUrl: candidate.sourceUrl?.url ?? String(proposedField.sourceUrl ?? ''),
      sourceSnippet: candidate.sourceSnippet ?? String(proposedField.citation ?? ''),
      reviewerId,
      sourceAuthorityStatus: candidate.sourceUrl?.authorityStatus,
    },
  })
  if (!decision.allowed) {
    return NextResponse.json({ error: decision.code }, { status: 422 })
  }
  const sourceUrl = candidate.sourceUrl?.url ?? String(proposedField.sourceUrl ?? '')
  const sourceSnippet = candidate.sourceSnippet ?? String(proposedField.citation ?? '')
  const retrievedAtValue = new Date(String(proposedField.retrievedAt ?? ''))
  let result: Awaited<ReturnType<typeof publishJurisdictionClaim>>
  try {
    result = await publishJurisdictionClaim({
      jurisdictionId: candidate.jurisdictionId,
      section: candidate.section,
      fieldKey: candidate.fieldKey,
      extractedValue: proposedField,
      question: decision.question,
      reviewerId,
      reviewerLabel,
      contradictionResolution: body.contradiction ? {
        decision: 'REPLACED_CURRENT',
        explanation: body.contradiction.explanation,
        expectedCurrentClaimId: body.contradiction.expectedCurrentClaimId,
        expectedCandidateUpdatedAt: new Date(body.contradiction.expectedCandidateUpdatedAt),
      } : undefined,
      source: {
        sourceUrlId: candidate.sourceUrlId,
        candidateId: candidate.id,
        candidateUpdatedAt: candidate.updatedAt,
        url: sourceUrl,
        snippet: sourceSnippet,
        retrievedAt: Number.isNaN(retrievedAtValue.getTime())
          ? candidate.updatedAt
          : retrievedAtValue,
        contentHash: typeof proposedField.contentHash === 'string'
          ? proposedField.contentHash
          : undefined,
        modelUsed: candidate.modelUsed,
        authorityClass: candidate.sourceUrl?.authorityClass,
        authorityOwner: candidate.sourceUrl?.authorityOwner,
        authorityStatus: candidate.sourceUrl?.authorityStatus ?? 'UNVERIFIED',
        authorityVerifiedAt: candidate.sourceUrl?.authorityVerifiedAt,
        authorityVerifiedBy: candidate.sourceUrl?.authorityVerifiedBy,
      },
    })
  } catch (error) {
    const code = error instanceof Error ? error.message : 'PUBLICATION_FAILED'
    const status = code === 'SOURCE_REJECTED' ? 422
      : code === 'CLAIM_CONTRADICTION_EXPLANATION_REQUIRED' ? 422
        : 409
    return NextResponse.json({ error: code }, { status })
  }

  return NextResponse.json({ ok: true, claimId: result.claimId })
}
