import { db } from '@/lib/db'
import { notFound, redirect } from 'next/navigation'
import { isSuperAdmin } from '@/lib/admin-auth'
import Link from 'next/link'
import RulesClient from './RulesClient'
import { getStateInfo, investmentTypeBadgeClass } from '@/lib/state-info'

export const dynamic = 'force-dynamic'

const INVESTMENT_LABELS: Record<string, string> = {
  LIEN: 'Tax Lien',
  DEED: 'Tax Deed',
  REDEEMABLE_DEED: 'Redeemable Deed',
}

export default async function JurisdictionRulesPage({
  params,
}: {
  params: Promise<{ jurisdictionId: string }>
}) {
  // Gate at the page, not just the layout — layouts render in parallel with pages.
  if (!(await isSuperAdmin())) redirect('/')

  const { jurisdictionId } = await params

  const jurisdiction = await db.jurisdiction.findUnique({
    where: { id: jurisdictionId },
    include: {
      ruleSets: {
        orderBy: [{ isActive: 'desc' }, { effectiveDate: 'desc' }],
        include: {
          rules: { orderBy: [{ sortOrder: 'asc' }, { offsetDays: 'asc' }] },
        },
      },
    },
  })

  if (!jurisdiction) notFound()

  // How many other counties in the same state have no active ruleset
  const stateInfo = getStateInfo(jurisdiction.state)

  const stateMissingCount = await db.jurisdiction.count({
    where: {
      state: jurisdiction.state,
      id: { not: jurisdictionId },
      ruleSets: { none: { isActive: true } },
    },
  })

  const ruleSets = jurisdiction.ruleSets.map((rs) => ({
    id: rs.id,
    name: rs.name,
    effectiveDate: rs.effectiveDate.toISOString().slice(0, 10),
    isActive: rs.isActive,
    rules: rs.rules.map((r) => ({
      id: r.id,
      eventType: r.eventType as string,
      label: r.label,
      anchorField: r.anchorField,
      offsetDays: r.offsetDays,
      sortOrder: r.sortOrder,
      description: r.description,
    })),
  }))

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-zinc-500">
        <Link href="/admin/rules" className="hover:text-zinc-900">
          Jurisdictions
        </Link>
        <span>/</span>
        <span className="text-zinc-900">
          {jurisdiction.county}, {jurisdiction.state}
        </span>
      </nav>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">
          {jurisdiction.county} County, {jurisdiction.stateName}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {INVESTMENT_LABELS[jurisdiction.investmentType] ?? jurisdiction.investmentType} ·{' '}
          {jurisdiction.timezone}
          {jurisdiction.notes && (
            <>
              {' '}· <span className="italic">{jurisdiction.notes}</span>
            </>
          )}
        </p>
      </div>

      {/* State reference panel */}
      {stateInfo && (
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-zinc-900">
              {stateInfo.stateName} — State Reference
            </h2>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${investmentTypeBadgeClass(stateInfo.investmentType)}`}
            >
              {stateInfo.investmentLabel}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm mb-4">
            {stateInfo.interestRate && (
              <div>
                <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-0.5">Interest / Penalty</p>
                <p className="text-zinc-900 font-medium">{stateInfo.interestRate}</p>
              </div>
            )}
            {stateInfo.bidMethod && (
              <div>
                <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-0.5">Bid Method</p>
                <p className="text-zinc-900">{stateInfo.bidMethod}</p>
              </div>
            )}
            {stateInfo.redemptionPeriod && (
              <div>
                <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-0.5">Redemption Period</p>
                <p className="text-zinc-900">{stateInfo.redemptionPeriod}</p>
              </div>
            )}
            {stateInfo.saleDates && (
              <div>
                <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-0.5">Sale Dates</p>
                <p className="text-zinc-900">{stateInfo.saleDates}</p>
              </div>
            )}
            <div>
              <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-0.5">Over-the-Counter</p>
              <p className={stateInfo.overTheCounter ? 'text-emerald-700 font-medium' : 'text-zinc-500'}>
                {stateInfo.overTheCounter ? 'Available' : 'Not Available'}
              </p>
            </div>
          </div>

          {stateInfo.summary && (
            <p className="text-sm text-zinc-600 leading-relaxed border-t border-zinc-100 pt-3">
              {stateInfo.summary}
            </p>
          )}

          {(stateInfo.stateWebsite || stateInfo.stateStatutes) && (
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-zinc-100">
              {stateInfo.stateWebsite && (
                <a
                  href={stateInfo.stateWebsite}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline"
                >
                  State Website ↗
                </a>
              )}
              {stateInfo.stateStatutes && (
                <a
                  href={stateInfo.stateStatutes}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline"
                >
                  State Statutes ↗
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {/* Ruleset editor */}
      <RulesClient
        jurisdictionId={jurisdictionId}
        stateName={jurisdiction.stateName}
        stateMissingCount={stateMissingCount}
        isAvailable={jurisdiction.isAvailable}
        ruleSets={ruleSets}
      />
    </div>
  )
}
