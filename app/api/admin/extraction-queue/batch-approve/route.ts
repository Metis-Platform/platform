import { NextResponse } from 'next/server'
import { z } from 'zod'
import { currentUser } from '@clerk/nextjs/server'
import { isSuperAdmin } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import { isJurisdictionProfileSection } from '@/lib/jurisdiction-profile'
import { publishJurisdictionClaim } from '@/lib/jurisdiction-claim-publication'
import { evaluateJurisdictionPublication } from '@/lib/jurisdiction-publication-policy'

const schema = z.object({
  minConfidence: z.number().min(0).max(1).default(0.85),
  section: z.string().optional(),
})

export async function POST(req: Request): Promise<NextResponse> {
  if (!(await isSuperAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const { minConfidence, section } = parsed.data

  const pending = await db.extractionCandidate.findMany({
    where: {
      status: 'PENDING',
      confidence: { gte: minConfidence },
      ...(section ? { section } : {}),
    },
    include: {
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
    take: 500,
  })

  const user = await currentUser()
  const reviewerId = user?.id ?? ''
  const reviewerLabel = user?.emailAddresses.find(e => e.id === user.primaryEmailAddressId)
    ?.emailAddress ?? reviewerId

  let approved = 0
  let blocked = 0
  let errors = 0

  for (const candidate of pending) {
    if (!isJurisdictionProfileSection(candidate.section)) { errors++; continue }

    const fieldKey = candidate.fieldKey
    const sectionKey = candidate.section
    const fieldValue = candidate.extractedValue as Record<string, unknown>
    const decision = evaluateJurisdictionPublication({
      section: sectionKey,
      fieldKey,
      mode: 'HUMAN_BATCH',
      evidence: {
        sourceUrl: candidate.sourceUrl?.url ?? String(fieldValue.sourceUrl ?? ''),
        sourceSnippet: candidate.sourceSnippet ?? String(fieldValue.citation ?? ''),
        reviewerId,
        sourceAuthorityStatus: candidate.sourceUrl?.authorityStatus,
      },
    })
    if (!decision.allowed) {
      blocked++
      continue
    }
    try {
      const retrievedAtValue = new Date(String(fieldValue.retrievedAt ?? ''))
      await publishJurisdictionClaim({
        jurisdictionId: candidate.jurisdictionId,
        section: sectionKey,
        fieldKey,
        extractedValue: fieldValue,
        question: decision.question,
        reviewerId,
        reviewerLabel,
        source: {
          sourceUrlId: candidate.sourceUrlId,
          candidateId: candidate.id,
          candidateUpdatedAt: candidate.updatedAt,
          url: candidate.sourceUrl?.url ?? String(fieldValue.sourceUrl ?? ''),
          snippet: candidate.sourceSnippet ?? String(fieldValue.citation ?? ''),
          retrievedAt: Number.isNaN(retrievedAtValue.getTime())
            ? candidate.updatedAt
            : retrievedAtValue,
          contentHash: typeof fieldValue.contentHash === 'string'
            ? fieldValue.contentHash
            : undefined,
          modelUsed: candidate.modelUsed,
          authorityClass: candidate.sourceUrl?.authorityClass,
          authorityOwner: candidate.sourceUrl?.authorityOwner,
          authorityStatus: candidate.sourceUrl?.authorityStatus ?? 'UNVERIFIED',
          authorityVerifiedAt: candidate.sourceUrl?.authorityVerifiedAt,
          authorityVerifiedBy: candidate.sourceUrl?.authorityVerifiedBy,
        },
      })
      approved++
    } catch {
      errors++
    }
  }

  return NextResponse.json({ approved, blocked, errors, total: pending.length })
}
