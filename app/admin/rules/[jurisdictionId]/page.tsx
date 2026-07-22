import { db } from '@/lib/db'
import { notFound, redirect } from 'next/navigation'
import { isSuperAdmin } from '@/lib/admin-auth'
import Link from 'next/link'
import RulesClient from './RulesClient'
import StrategyDataClient from './StrategyDataClient'
import AuthorityBoundaryClient from './AuthorityBoundaryClient'
import AuthorityScopeClaimClient from './AuthorityScopeClaimClient'
import CanonicalAcceptanceClient from './CanonicalAcceptanceClient'
import { getStateInfo, investmentTypeBadgeClass } from '@/lib/state-info'
import { AuctionFeedSource } from '@/app/generated/prisma'
import { DISABLED_AUCTION_FEEDS } from '@/lib/auction-feed-availability'
import {
  isCurrentVerifiedLocalAuthorityClaim,
  UNINCORPORATED_COUNTY_LAND_USE_AUTHORITY_SCOPE,
  type CountyLandUseAuthorityClaim,
} from '@/lib/jurisdiction-land-use-authority'
import { listCurrentUnincorporatedAuthorityBoundaries } from '@/lib/jurisdiction-authority-boundary'
import { COUNTY_LAND_USE_AUTHORITY_SCOPE_FIELD } from '@/lib/jurisdiction-question-library'
import { JURISDICTION_QUESTION_SCHEMA_VERSION } from '@/lib/jurisdiction-question-library'

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

  const [jurisdiction, strategyDataRows, upcomingSales, authorityClaims, authorityBoundaries, authoritySources, canonicalAcceptance] = await Promise.all([
    db.jurisdiction.findUnique({
      where: { id: jurisdictionId },
      include: {
        ruleSets: {
          orderBy: [{ isActive: 'desc' }, { effectiveDate: 'desc' }],
          include: {
            rules: { orderBy: [{ sortOrder: 'asc' }, { offsetDays: 'asc' }] },
          },
        },
      },
    }),
    db.jurisdictionStrategyData.findMany({ where: { jurisdictionId } }),
    db.auctionSaleFeed.findMany({
      where: { jurisdictionId, saleDate: { gte: new Date() } },
      orderBy: { saleDate: 'asc' },
      take: 12,
    }),
    db.jurisdictionClaim.findMany({
      where: {
        jurisdictionId,
        section: 'zoning',
        fieldKey: COUNTY_LAND_USE_AUTHORITY_SCOPE_FIELD,
        supersededByClaim: null,
      },
      select: {
        id: true,
        section: true,
        fieldKey: true,
        value: true,
        geographicScope: true,
        expectedAuthorityClass: true,
        sourceAuthorityClass: true,
        sourceAuthorityOwner: true,
        sourceAuthorityStatus: true,
        sourceAuthorityVerifiedAt: true,
        sourceAuthorityVerifiedBy: true,
        verificationState: true,
        reviewedAt: true,
        freshness: { select: { reviewDueAt: true, staleAt: true } },
        evidence: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            sourceUrl: true,
            sourceUrlRecord: {
              select: {
                authorityClass: true,
                authorityOwner: true,
                authorityStatus: true,
                authorityVerifiedAt: true,
                authorityVerifiedBy: true,
              },
            },
          },
        },
      },
    }),
    listCurrentUnincorporatedAuthorityBoundaries(jurisdictionId),
    db.jurisdictionSourceUrl.findMany({
      where: {
        jurisdictionId,
        authorityStatus: 'VERIFIED',
        authorityClass: 'LOCAL_OFFICIAL',
        evidenceSnapshots: { some: {} },
      },
      select: {
        id: true,
        url: true,
        evidenceSnapshots: {
          orderBy: { retrievedAt: 'desc' },
          take: 1,
          select: { retrievedAt: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    }),
    db.jurisdictionCanonicalAcceptance.findFirst({
      where: { jurisdictionId, supersededByAcceptance: null },
      select: { id: true, contractVersion: true, caseReference: true, evidenceUrl: true, result: true, reviewedAt: true },
      orderBy: { reviewedAt: 'desc' },
    }),
  ])

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
  const eligibleAuthorityClaims = authorityClaims
    .filter(claim => isCurrentVerifiedLocalAuthorityClaim(
      claim as CountyLandUseAuthorityClaim,
      UNINCORPORATED_COUNTY_LAND_USE_AUTHORITY_SCOPE,
    ))
    .map(claim => ({
      id: claim.id,
      sourceUrl: claim.evidence[0].sourceUrl,
      reviewedAt: claim.reviewedAt.toISOString(),
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

      {/* Strategy-specific data */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900 mb-1">Strategy Data</h2>
        <p className="text-xs text-zinc-500 mb-4">
          Jurisdiction-specific legal data by strategy. Used to surface relevant rules to investors on deal pages.
        </p>
        <StrategyDataClient
          jurisdictionId={jurisdictionId}
          initialData={strategyDataRows.map((r) => ({
            strategy: r.strategy,
            data: r.data as Record<string, unknown>,
            updatedAt: r.updatedAt.toISOString(),
          }))}
        />
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900 mb-1">County land-use authority scope</h2>
        <AuthorityScopeClaimClient
          jurisdictionId={jurisdictionId}
          sources={authoritySources.flatMap(source => source.evidenceSnapshots[0]
            ? [{ id: source.id, url: source.url, retrievedAt: source.evidenceSnapshots[0].retrievedAt.toISOString() }]
            : [])}
        />
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900 mb-1">Canonical county acceptance</h2>
        <CanonicalAcceptanceClient
          jurisdictionId={jurisdictionId}
          contractVersion={JURISDICTION_QUESTION_SCHEMA_VERSION}
          currentAcceptance={canonicalAcceptance && { ...canonicalAcceptance, reviewedAt: canonicalAcceptance.reviewedAt.toISOString() }}
        />
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900 mb-1">Unincorporated authority boundary</h2>
        <AuthorityBoundaryClient
          jurisdictionId={jurisdictionId}
          claims={eligibleAuthorityClaims}
          initialBoundaries={authorityBoundaries.map(boundary => ({
            ...boundary,
            createdAt: boundary.createdAt.toISOString(),
          }))}
        />
      </div>

      {/* Auction Calendar */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold text-zinc-900">Auction Calendar</h2>
          <span className="text-xs text-amber-700">Providers not connected</span>
        </div>
        <p className="text-xs text-zinc-500 mb-4">
          Historical feed records are shown below. GovEase, RealAuction (FL), and Tax Sale Resources are not currently connected.
        </p>
        {upcomingSales.length === 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 space-y-1">
            {Object.values(DISABLED_AUCTION_FEEDS).map(reason => <p key={reason}>{reason}</p>)}
            <p>Existing records are historical and must be independently verified with the county or auction platform.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th className="text-left py-2 pr-4 text-xs font-medium text-zinc-500 uppercase tracking-wide">Sale Date</th>
                  <th className="text-left py-2 pr-4 text-xs font-medium text-zinc-500 uppercase tracking-wide">Source</th>
                  <th className="text-left py-2 pr-4 text-xs font-medium text-zinc-500 uppercase tracking-wide">Registration Deadline</th>
                  <th className="text-left py-2 pr-4 text-xs font-medium text-zinc-500 uppercase tracking-wide">Deposit</th>
                  <th className="text-left py-2 text-xs font-medium text-zinc-500 uppercase tracking-wide">Last Synced</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {upcomingSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-zinc-50">
                    <td className="py-2.5 pr-4 font-medium text-zinc-900">
                      {sale.platformUrl ? (
                        <a
                          href={sale.platformUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {sale.saleDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </a>
                      ) : (
                        sale.saleDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      )}
                    </td>
                    <td className="py-2.5 pr-4">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${SOURCE_BADGE[sale.source]}`}>
                        {SOURCE_LABEL[sale.source]}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-zinc-600">
                      {sale.registrationDeadline
                        ? sale.registrationDeadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : <span className="text-zinc-300">—</span>}
                    </td>
                    <td className="py-2.5 pr-4 text-zinc-600">
                      {sale.depositRequirementCents != null
                        ? `$${(sale.depositRequirementCents / 100).toLocaleString()}`
                        : <span className="text-zinc-300">—</span>}
                    </td>
                    <td className="py-2.5 text-zinc-400 text-xs">
                      {sale.syncedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

const SOURCE_LABEL: Record<AuctionFeedSource, string> = {
  GOVEASE: 'GovEase',
  REALAUCTION_FL: 'RealAuction FL',
  TAX_SALE_RESOURCES: 'Tax Sale Resources',
}

const SOURCE_BADGE: Record<AuctionFeedSource, string> = {
  GOVEASE: 'bg-blue-50 text-blue-700',
  REALAUCTION_FL: 'bg-emerald-50 text-emerald-700',
  TAX_SALE_RESOURCES: 'bg-amber-50 text-amber-700',
}
