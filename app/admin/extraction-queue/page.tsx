import { isSuperAdmin } from '@/lib/admin-auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { ExtractionQueueClient } from './ExtractionQueueClient'
import type { ExtractionStatus } from '@/app/generated/prisma'

type Props = {
  searchParams: Promise<{ status?: string; section?: string }>
}

export default async function ExtractionQueuePage({ searchParams }: Props) {
  if (!(await isSuperAdmin())) redirect('/')

  const { status = 'PENDING', section } = await searchParams
  const statusFilter = ['PENDING', 'APPROVED', 'REJECTED'].includes(status)
    ? (status as ExtractionStatus)
    : 'PENDING'

  const [candidates, pendingCount, sourceUrlCount, fetchedCount] = await Promise.all([
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

      <ExtractionQueueClient
        candidates={candidates}
        pendingCount={pendingCount}
        statusFilter={statusFilter}
        sectionFilter={section ?? ''}
        allSections={allSections}
      />
    </div>
  )
}
