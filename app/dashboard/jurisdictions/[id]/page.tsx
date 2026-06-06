import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { syncUserToDatabase } from '@/lib/sync-user'
import { getStateInfo, investmentTypeBadgeClass } from '@/lib/state-info'

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
      ruleSets: {
        orderBy: [{ isActive: 'desc' }, { effectiveDate: 'desc' }],
        include: { rules: { orderBy: [{ sortOrder: 'asc' }, { offsetDays: 'asc' }] } },
      },
      _count: { select: { properties: true } },
    },
  })

  if (!jurisdiction) notFound()

  const stateInfo = getStateInfo(jurisdiction.state)
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

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-500">{jurisdiction.stateName}</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-zinc-900">
              {jurisdiction.county} County Research Hub
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
              {stateInfo?.summary ?? jurisdiction.notes ?? 'County-level rules and resources for evaluating tax sale opportunities.'}
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

      <div className="grid gap-4 lg:grid-cols-4">
        <InfoCard label="Interest / Penalty" value={stateInfo?.interestRate ?? 'Varies by county'} />
        <InfoCard label="Bid Method" value={stateInfo?.bidMethod ?? 'Varies'} />
        <InfoCard label="Redemption Period" value={stateInfo?.redemptionPeriod ?? 'N/A'} />
        <InfoCard label="Sale Dates" value={stateInfo?.saleDates ?? 'Varies'} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">Rules and deadlines</h2>
              <p className="mt-1 text-sm text-zinc-500">
                {activeRuleSet ? `${activeRuleSet.name} · effective ${formatDate(activeRuleSet.effectiveDate)}` : 'No active ruleset yet.'}
              </p>
            </div>
            {activeRuleSet && (
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                {activeRuleSet.rules.length} rules
              </span>
            )}
          </div>

          {activeRuleSet ? (
            <div className="mt-4 overflow-hidden rounded-lg border border-zinc-200">
              <table className="min-w-full divide-y divide-zinc-200 text-sm">
                <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">Deadline</th>
                    <th className="px-4 py-3">Anchor</th>
                    <th className="px-4 py-3">Offset</th>
                    <th className="px-4 py-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 bg-white">
                  {activeRuleSet.rules.map((rule) => (
                    <tr key={rule.id}>
                      <td className="px-4 py-3 font-medium text-zinc-900">{rule.label}</td>
                      <td className="px-4 py-3 text-zinc-600">{rule.anchorField}</td>
                      <td className="px-4 py-3 text-zinc-600">{rule.offsetDays} days</td>
                      <td className="px-4 py-3 text-zinc-500">{rule.description ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-dashed border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              Rules are not configured yet. Use the state reference and official links below for manual research until an admin activates a ruleset.
            </div>
          )}
        </section>

        <aside className="space-y-6">
          <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-zinc-900">Official resources</h2>
            <div className="mt-4 space-y-3">
              {stateInfo?.stateWebsite && <ResourceLink label="State website" url={stateInfo.stateWebsite} />}
              {stateInfo?.stateStatutes && <ResourceLink label="State statutes" url={stateInfo.stateStatutes} />}
              {links.map((link) => <ResourceLink key={link.url} label={link.label} url={link.url} />)}
              {!stateInfo?.stateWebsite && !stateInfo?.stateStatutes && links.length === 0 && (
                <p className="text-sm text-zinc-500">No official links have been added for this jurisdiction.</p>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-zinc-900">County notes</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="font-medium text-zinc-500">Timezone</dt>
                <dd className="mt-0.5 text-zinc-900">{jurisdiction.timezone}</dd>
              </div>
              <div>
                <dt className="font-medium text-zinc-500">Tracked properties</dt>
                <dd className="mt-0.5 text-zinc-900">{jurisdiction._count.properties}</dd>
              </div>
              <div>
                <dt className="font-medium text-zinc-500">Over-the-counter</dt>
                <dd className={stateInfo?.overTheCounter ? 'mt-0.5 font-medium text-emerald-700' : 'mt-0.5 text-zinc-900'}>
                  {stateInfo?.overTheCounter ? 'Available' : 'Not indicated'}
                </dd>
              </div>
              {jurisdiction.notes && (
                <div>
                  <dt className="font-medium text-zinc-500">Notes</dt>
                  <dd className="mt-0.5 text-zinc-900">{jurisdiction.notes}</dd>
                </div>
              )}
            </dl>
          </section>
        </aside>
      </div>
    </div>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{label}</p>
      <p className="mt-2 text-sm font-medium text-zinc-900">{value}</p>
    </div>
  )
}

function ResourceLink({ label, url }: { label: string; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-blue-700 transition hover:border-blue-200 hover:bg-blue-50"
    >
      <span>{label}</span>
      <span aria-hidden="true">↗</span>
    </a>
  )
}
