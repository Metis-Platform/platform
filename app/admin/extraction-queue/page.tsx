import { isSuperAdmin } from '@/lib/admin-auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { ExtractionQueueClient } from './ExtractionQueueClient'
import { SourceAuthorityReviewClient } from './SourceAuthorityReviewClient'
import type {
  ExtractionStatus,
  JurisdictionSourceAuthorityStatus,
} from '@/app/generated/prisma'

type Props = {
  searchParams: Promise<{ status?: string; section?: string; sourceStatus?: string }>
}

export default async function ExtractionQueuePage({ searchParams }: Props) {
  if (!(await isSuperAdmin())) redirect('/')

  const { status = 'PENDING', section, sourceStatus = 'UNVERIFIED' } = await searchParams
  const statusFilter = ['PENDING', 'APPROVED', 'REJECTED'].includes(status)
    ? (status as ExtractionStatus)
    : 'PENDING'
  const sourceStatusFilter = ['UNVERIFIED', 'VERIFIED', 'REJECTED', 'ALL'].includes(sourceStatus)
    ? sourceStatus
    : 'UNVERIFIED'

  const [candidates, pendingCount, sourceUrlCount, fetchedCount, sources] = await Promise.all([
    db.extractionCandidate.findMany({
      where: {
        status: statusFilter,
        ...(section ? { section } : {}),
      },
      include: {
        jurisdiction: { select: { county: true, state: true } },
        sourceUrl: { select: { url: true, officeType: true } },
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
      />

      <div className="my-8 border-t border-zinc-200" />

      <ExtractionQueueClient
        candidates={candidates}
        pendingCount={pendingCount}
        statusFilter={statusFilter}
        sectionFilter={section ?? ''}
        sourceStatusFilter={sourceStatusFilter}
        allSections={allSections}
      />
    </div>
  )
}
