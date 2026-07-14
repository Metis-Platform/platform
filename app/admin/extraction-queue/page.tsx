import { isSuperAdmin } from '@/lib/admin-auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { ExtractionQueueClient } from './ExtractionQueueClient'
import { SourceAuthorityReviewClient } from './SourceAuthorityReviewClient'
import { ClaimFreshnessReviewClient } from './ClaimFreshnessReviewClient'
import type {
  ExtractionStatus,
  JurisdictionSourceAuthorityStatus,
} from '@/app/generated/prisma'
import { claimFreshnessStatus } from '@/lib/jurisdiction-claim-freshness'
import { getJurisdictionQuestion } from '@/lib/jurisdiction-question-library'
import {
  claimValuesConflict,
  extractedClaimValue,
} from '@/lib/jurisdiction-claim-contradiction'
import { isJurisdictionProfileSection } from '@/lib/jurisdiction-profile'

type Props = {
  searchParams: Promise<{
    status?: string
    section?: string
    sourceStatus?: string
    freshnessStatus?: string
  }>
}

export default async function ExtractionQueuePage({ searchParams }: Props) {
  if (!(await isSuperAdmin())) redirect('/')

  const {
    status = 'PENDING',
    section,
    sourceStatus = 'UNVERIFIED',
    freshnessStatus = 'STALE',
  } = await searchParams
  const statusFilter = ['PENDING', 'APPROVED', 'REJECTED'].includes(status)
    ? (status as ExtractionStatus)
    : 'PENDING'
  const sourceStatusFilter = ['UNVERIFIED', 'VERIFIED', 'REJECTED', 'ALL'].includes(sourceStatus)
    ? sourceStatus
    : 'UNVERIFIED'
  const freshnessStatusFilter = ['CURRENT', 'REVIEW_DUE', 'STALE'].includes(freshnessStatus)
    ? freshnessStatus as 'CURRENT' | 'REVIEW_DUE' | 'STALE'
    : 'STALE'

  const [candidates, pendingCount, sourceUrlCount, fetchedCount, sources] = await Promise.all([
    db.extractionCandidate.findMany({
      where: {
        status: statusFilter,
        ...(section ? { section } : {}),
      },
      include: {
        jurisdiction: { select: { county: true, state: true } },
        sourceUrl: { select: { url: true, officeType: true } },
        contradictionReviews: {
          orderBy: { reviewedAt: 'desc' },
          take: 3,
          select: {
            id: true,
            decision: true,
            explanation: true,
            existingValue: true,
            proposedValue: true,
            reviewedAt: true,
            reviewedBy: true,
            replacementClaimId: true,
          },
        },
      },
      orderBy: [{ confidence: 'desc' }, { createdAt: 'asc' }],
      take: 100,
    }),
    db.extractionCandidate.count({ where: { status: 'PENDING' } }),
    db.jurisdictionSourceUrl.count(),
    db.jurisdictionSourceUrl.count({ where: { lastFetchedAt: { not: null } } }),
    db.jurisdictionSourceUrl.findMany({
      where: sourceStatusFilter === 'ALL'
        ? {}
        : { authorityStatus: sourceStatusFilter as JurisdictionSourceAuthorityStatus },
      include: {
        jurisdiction: { select: { county: true, state: true } },
        authorityReviews: {
          orderBy: { reviewedAt: 'desc' },
          take: 3,
          select: {
            id: true,
            decision: true,
            explanation: true,
            evidenceUrl: true,
            reviewedAt: true,
            reviewedBy: true,
          },
        },
      },
      orderBy: [{ updatedAt: 'asc' }, { createdAt: 'asc' }],
      take: 100,
    }),
  ])

  const allSections = Array.from(new Set(
    (await db.extractionCandidate.findMany({
      where: { status: statusFilter },
      select: { section: true },
      distinct: ['section'],
    })).map(c => c.section)
  )).sort()

  const candidateProfiles = candidates.length > 0
    ? await db.jurisdictionProfile.findMany({
        where: { jurisdictionId: { in: [...new Set(candidates.map(c => c.jurisdictionId))] } },
      })
    : []
  const profilesByJurisdiction = new Map(
    candidateProfiles.map(profile => [profile.jurisdictionId, profile]),
  )
  const projectedClaimIds = candidates.flatMap(candidate => {
    if (!isJurisdictionProfileSection(candidate.section)) return []
    const profile = profilesByJurisdiction.get(candidate.jurisdictionId)
    const sectionFields = (profile?.[candidate.section] ?? {}) as Record<string, unknown>
    const claimId = (sectionFields[candidate.fieldKey] as { claimId?: unknown } | undefined)?.claimId
    return typeof claimId === 'string' ? [claimId] : []
  })
  const activeClaims = projectedClaimIds.length > 0
    ? await db.jurisdictionClaim.findMany({
        where: {
          id: { in: projectedClaimIds },
          supersededByClaim: null,
        },
        select: {
          id: true,
          jurisdictionId: true,
          section: true,
          fieldKey: true,
          value: true,
          normalizedUnit: true,
        },
      })
    : []
  const claimsById = new Map(activeClaims.map(claim => [claim.id, claim]))
  const candidateRows = candidates.map(candidate => {
    const profile = profilesByJurisdiction.get(candidate.jurisdictionId)
    const sectionFields = isJurisdictionProfileSection(candidate.section)
      ? (profile?.[candidate.section] ?? {}) as Record<string, unknown>
      : {}
    const projectedClaimId = (
      sectionFields[candidate.fieldKey] as { claimId?: unknown } | undefined
    )?.claimId
    const projectedClaim = typeof projectedClaimId === 'string'
      ? claimsById.get(projectedClaimId) ?? null
      : null
    const currentClaim = projectedClaim &&
      projectedClaim.jurisdictionId === candidate.jurisdictionId &&
      projectedClaim.section === candidate.section &&
      projectedClaim.fieldKey === candidate.fieldKey
      ? projectedClaim
      : null
    const proposed = extractedClaimValue(candidate.extractedValue)
    return {
      ...candidate,
      updatedAt: candidate.updatedAt.toISOString(),
      contradictionReviews: candidate.contradictionReviews.map(review => ({
        ...review,
        reviewedAt: review.reviewedAt.toISOString(),
      })),
      currentClaim: currentClaim ? {
        id: currentClaim.id,
        value: currentClaim.value,
        normalizedUnit: currentClaim.normalizedUnit,
      } : null,
      potentialContradiction: Boolean(
        currentClaim && claimValuesConflict(currentClaim, proposed),
      ),
    }
  })

  const now = new Date()
  const freshnessRows = await db.jurisdictionClaimFreshness.findMany({
    where: {
      claim: { supersededByClaim: null },
      ...(freshnessStatusFilter === 'CURRENT'
        ? { reviewDueAt: { gt: now } }
        : freshnessStatusFilter === 'REVIEW_DUE'
          ? { reviewDueAt: { lte: now }, staleAt: { gt: now } }
          : { staleAt: { lte: now } }),
    },
    include: {
      claim: {
        include: {
          jurisdiction: { select: { county: true, state: true } },
          evidence: { select: { sourceUrlId: true, contentHash: true, sourceUrl: true } },
          reReviews: {
            orderBy: { reviewedAt: 'desc' },
            take: 3,
            select: {
              id: true,
              explanation: true,
              evidenceRetrievedAt: true,
              reviewedAt: true,
              reviewedBy: true,
            },
          },
        },
      },
    },
    orderBy: [{ staleAt: 'asc' }, { reviewDueAt: 'asc' }],
    take: 50,
  })

  const freshnessClaims = await Promise.all(freshnessRows.map(async row => {
    const evidencePairs = row.claim.evidence.flatMap(evidence =>
      evidence.sourceUrlId && evidence.contentHash
        ? [{ sourceUrlId: evidence.sourceUrlId, contentHash: evidence.contentHash }]
        : []
    )
    const eligibleSnapshot = row.claim.risk !== 'UNKNOWN' &&
      row.claim.volatility !== 'UNKNOWN' && evidencePairs.length > 0
      ? await db.jurisdictionEvidenceSnapshot.findFirst({
          where: {
            jurisdictionId: row.claim.jurisdictionId,
            retrievedAt: { gt: row.lastEvidenceRetrievedAt },
            OR: evidencePairs,
          },
          orderBy: { retrievedAt: 'desc' },
          select: {
            id: true,
            sourceUrl: true,
            retrievedAt: true,
            contentHash: true,
          },
        })
      : null
    const question = getJurisdictionQuestion(row.claim.section, row.claim.fieldKey)
    return {
      id: row.claim.id,
      jurisdiction: row.claim.jurisdiction,
      label: question?.label ?? `${row.claim.section}.${row.claim.fieldKey}`,
      section: row.claim.section,
      fieldKey: row.claim.fieldKey,
      value: row.claim.value,
      verificationState: row.claim.verificationState,
      risk: row.claim.risk,
      volatility: row.claim.volatility,
      status: claimFreshnessStatus(row, now),
      lastEvidenceRetrievedAt: row.lastEvidenceRetrievedAt.toISOString(),
      reviewDueAt: row.reviewDueAt.toISOString(),
      staleAt: row.staleAt.toISOString(),
      policyVersion: row.policyVersion,
      freshnessUpdatedAt: row.updatedAt.toISOString(),
      sourceUrl: row.claim.evidence[0]?.sourceUrl ?? null,
      eligibleSnapshot: eligibleSnapshot ? {
        ...eligibleSnapshot,
        retrievedAt: eligibleSnapshot.retrievedAt.toISOString(),
      } : null,
      reReviews: row.claim.reReviews.map(review => ({
        ...review,
        evidenceRetrievedAt: review.evidenceRetrievedAt.toISOString(),
        reviewedAt: review.reviewedAt.toISOString(),
      })),
    }
  }))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Extraction Queue</h1>
          <p className="text-sm text-zinc-500 mt-0.5">AI-extracted jurisdiction fields awaiting review</p>
        </div>
        <div className="flex items-center gap-4 text-sm text-zinc-500">
          <span>
            <span className="font-medium text-zinc-900">{sourceUrlCount.toLocaleString()}</span> source URLs
            {' · '}
            <span className="font-medium text-zinc-900">{fetchedCount.toLocaleString()}</span> fetched
          </span>
          {pendingCount > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-medium">
              {pendingCount} pending review
            </span>
          )}
        </div>
      </div>

      <SourceAuthorityReviewClient
        sources={sources.map(source => ({
          ...source,
          lastFetchedAt: source.lastFetchedAt?.toISOString() ?? null,
          updatedAt: source.updatedAt.toISOString(),
          createdAt: source.createdAt.toISOString(),
          authorityVerifiedAt: source.authorityVerifiedAt?.toISOString() ?? null,
          authorityReviews: source.authorityReviews.map(review => ({
            ...review,
            reviewedAt: review.reviewedAt.toISOString(),
          })),
        }))}
        sourceStatusFilter={sourceStatusFilter}
        candidateStatusFilter={statusFilter}
        sectionFilter={section ?? ''}
        freshnessStatusFilter={freshnessStatusFilter}
      />

      <div className="my-8 border-t border-zinc-200" />

      <ClaimFreshnessReviewClient
        claims={freshnessClaims}
        freshnessStatusFilter={freshnessStatusFilter}
        sourceStatusFilter={sourceStatusFilter}
        candidateStatusFilter={statusFilter}
        sectionFilter={section ?? ''}
      />

      <div className="my-8 border-t border-zinc-200" />

      <ExtractionQueueClient
        candidates={candidateRows}
        pendingCount={pendingCount}
        statusFilter={statusFilter}
        sectionFilter={section ?? ''}
        sourceStatusFilter={sourceStatusFilter}
        allSections={allSections}
        freshnessStatusFilter={freshnessStatusFilter}
      />
    </div>
  )
}
