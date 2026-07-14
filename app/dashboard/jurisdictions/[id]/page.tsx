import { auth } from '@clerk/nextjs/server'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { db } from '@/lib/db'
import {
  blockContradictoryResearchFields,
  buildResearchProfile,
  retainActiveClaimBackedResearchFields,
} from '@/lib/jurisdiction-research'
import { getStateInfo, investmentTypeBadgeClass } from '@/lib/state-info'
import { syncUserToDatabase } from '@/lib/sync-user'
import JurisdictionResearchHub from './JurisdictionResearchHub'
import {
  claimValuesConflict,
  extractedClaimValue,
} from '@/lib/jurisdiction-claim-contradiction'
import { isJurisdictionProfileSection } from '@/lib/jurisdiction-profile'
import { deriveJurisdictionCoverageState } from '@/lib/jurisdiction-research-state'
import { JURISDICTION_QUESTIONS } from '@/lib/jurisdiction-question-library'
import { claimFreshnessStatus } from '@/lib/jurisdiction-claim-freshness'

type Links = Record<string, unknown>

export const dynamic = 'force-dynamic'

const INVESTMENT_LABELS: Record<string, string> = {
  LIEN: 'Tax Lien',
  DEED: 'Tax Deed',
  REDEEMABLE_DEED: 'Redeemable Deed',
}

const LINK_LABELS: Record<string, string> = {
  assessorUrl: 'Assessor',
  taxCollectorUrl: 'Tax Collector',
  recorderUrl: 'Recorder',
  gisUrl: 'GIS / Parcel Map',
  auctionUrl: 'Auction Site',
  clerkUrl: 'Clerk / Courts',
}

function isSafeExternalUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

function linkEntries(links: unknown) {
  if (!links || typeof links !== 'object' || Array.isArray(links)) return []

  return Object.entries(links as Links)
    .filter((entry): entry is [string, string] =>
      typeof entry[1] === 'string' &&
      entry[1].trim().length > 0 &&
      isSafeExternalUrl(entry[1])
    )
    .map(([key, value]) => ({ label: LINK_LABELS[key] ?? key.replace(/Url$/, '').replace(/([A-Z])/g, ' $1'), url: value }))
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

export default async function JurisdictionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) redirect('/sign-in')

  const synced = await syncUserToDatabase()
  if (!synced) redirect('/onboarding')

  const { id } = await params
  const jurisdiction = await db.jurisdiction.findUnique({
    where: { id },
    include: {
      profile: true,
      ruleSets: {
        orderBy: [{ isActive: 'desc' }, { effectiveDate: 'desc' }],
        include: { rules: { orderBy: [{ sortOrder: 'asc' }, { offsetDays: 'asc' }] } },
      },
      researchWork: true,
      researchDemands: { where: { tenantId: synced.tenant.id }, select: { id: true } },
    },
  })

  if (!jurisdiction) notFound()

  const researchProfile = buildResearchProfile(jurisdiction.profile)
  const projectedClaimIds = Object.values(researchProfile).flatMap(section =>
    Object.values(section).flatMap(field => field.claimId ? [field.claimId] : []),
  )

  const [trackedPropertyCount, pendingCandidates, activeClaims, sourceCount] = await Promise.all([
    db.property.count({
      where: {
        jurisdictionId: jurisdiction.id,
        tenantId: synced.tenant.id,
      },
    }),
    db.extractionCandidate.findMany({
      where: { jurisdictionId: jurisdiction.id, status: 'PENDING' },
      select: { section: true, fieldKey: true, extractedValue: true },
    }),
    db.jurisdictionClaim.findMany({
      where: {
        jurisdictionId: jurisdiction.id,
        id: { in: projectedClaimIds },
        supersededByClaim: null,
      },
      select: {
        id: true,
        section: true,
        fieldKey: true,
        value: true,
        normalizedUnit: true,
        verificationState: true,
        sourceAuthorityStatus: true,
        freshness: { select: { reviewDueAt: true, staleAt: true } },
      },
    }),
    db.jurisdictionSourceUrl.count({ where: { jurisdictionId: jurisdiction.id } }),
  ])
  const claimsById = new Map(activeClaims.map(claim => [claim.id, claim]))
  const activeResearchProfile = retainActiveClaimBackedResearchFields(researchProfile, activeClaims)
  const contradictoryFields = pendingCandidates.flatMap(candidate => {
    if (!isJurisdictionProfileSection(candidate.section)) return []
    const projectedClaimId = activeResearchProfile[candidate.section][candidate.fieldKey]?.claimId
    const claim = projectedClaimId ? claimsById.get(projectedClaimId) : null
    if (
      !claim ||
      claim.section !== candidate.section ||
      claim.fieldKey !== candidate.fieldKey ||
      !claimValuesConflict(claim, extractedClaimValue(candidate.extractedValue))
    ) return []
    return [{ section: candidate.section, fieldKey: candidate.fieldKey }]
  })

  const stateInfo = getStateInfo(jurisdiction.state)
  const coverageState = deriveJurisdictionCoverageState({
    workStatus: jurisdiction.researchWork?.status ?? null,
    sourceCount,
    requiredQuestionCount: JURISDICTION_QUESTIONS.length,
    verifiedCurrentClaimCount: activeClaims.filter(claim =>
      claim.verificationState === 'VERIFIED' && claim.sourceAuthorityStatus === 'VERIFIED',
    ).length,
    staleClaimCount: activeClaims.filter(claim =>
      claim.verificationState === 'STALE' ||
      !claim.freshness ||
      claimFreshnessStatus(claim.freshness) === 'STALE',
    ).length,
    blockedClaimCount: contradictoryFields.length,
    pendingCandidateCount: pendingCandidates.length,
  })
  const links = linkEntries(jurisdiction.links)
  const activeRuleSet = jurisdiction.ruleSets.find((ruleSet) => ruleSet.isActive) ?? null

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-2 text-sm text-zinc-500">
        <Link href="/dashboard/jurisdictions" className="hover:text-zinc-900">
          Jurisdictions
        </Link>
        <span>/</span>
        <span className="text-zinc-900">
          {jurisdiction.county} County, {jurisdiction.state}
        </span>
      </nav>

      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-500">{jurisdiction.stateName}</p>
            <h1 className="mt-1 text-3xl font-bold text-zinc-900">
              {jurisdiction.county} County Research Hub
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
              {stateInfo?.summary ?? jurisdiction.notes ?? 'County-level rules, market signals, contacts, and source-backed research for evaluating real estate investments.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${investmentTypeBadgeClass(stateInfo?.investmentType ?? 'NOT_ACTIVE')}`}
            >
              {stateInfo?.investmentLabel ?? INVESTMENT_LABELS[jurisdiction.investmentType] ?? jurisdiction.investmentType}
            </span>
            <span className={jurisdiction.isAvailable ? 'rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700' : 'rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-500'}>
              {jurisdiction.isAvailable ? 'Available for deal creation' : 'Research only'}
            </span>
          </div>
        </div>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Official resources</h2>
            <p className="mt-1 text-sm text-zinc-500">
              State and county sources used to verify profile fields.
            </p>
          </div>
          {activeRuleSet && (
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              Active ruleset: {activeRuleSet.name} · {formatDate(activeRuleSet.effectiveDate)}
            </span>
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {stateInfo?.stateWebsite && <ResourceLink label="State website" url={stateInfo.stateWebsite} />}
          {stateInfo?.stateStatutes && <ResourceLink label="State statutes" url={stateInfo.stateStatutes} />}
          {links.map((link) => <ResourceLink key={link.url} label={link.label} url={link.url} />)}
          {!stateInfo?.stateWebsite && !stateInfo?.stateStatutes && links.length === 0 && (
            <p className="text-sm text-zinc-500">No official links have been added for this jurisdiction.</p>
          )}
        </div>
      </section>

      <JurisdictionResearchHub
        jurisdictionId={jurisdiction.id}
        profile={blockContradictoryResearchFields(activeResearchProfile, contradictoryFields)}
        trackedPropertyCount={trackedPropertyCount}
        timezone={jurisdiction.timezone}
        coverageState={coverageState}
        hasResearchDemand={jurisdiction.researchDemands.length > 0}
        activeRuleSet={activeRuleSet ? {
          name: activeRuleSet.name,
          effectiveDate: activeRuleSet.effectiveDate.toISOString(),
          rules: activeRuleSet.rules.map((rule) => ({
            id: rule.id,
            label: rule.label,
            anchorField: rule.anchorField,
            offsetDays: rule.offsetDays,
            description: rule.description,
          })),
        } : null}
      />
    </div>
  )
}

function ResourceLink({ label, url }: { label: string; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-blue-700 transition hover:border-blue-200 hover:bg-blue-50"
    >
      {label}
    </a>
  )
}
