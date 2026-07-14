import Link from 'next/link'
import { redirect } from 'next/navigation'
import { isSuperAdmin } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import {
  compareJurisdictionCoveragePriority,
  summarizeJurisdictionCoverage,
} from '@/lib/jurisdiction-coverage'

export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ state?: string; view?: string }> }
const VIEWS = ['demanded', 'no-claims', 'unsafe', 'all'] as const

export default async function JurisdictionCoveragePage({ searchParams }: Props) {
  if (!(await isSuperAdmin())) redirect('/')
  const params = await searchParams
  const view = VIEWS.includes(params.view as typeof VIEWS[number]) ? params.view! : 'demanded'

  const [jurisdictions, requestGroups] = await Promise.all([
    db.jurisdiction.findMany({
      select: {
        id: true, state: true, county: true, fips: true, isAvailable: true, profile: true,
        claims: {
          where: { supersededByClaim: null },
          select: {
            id: true, section: true, fieldKey: true, value: true, normalizedUnit: true,
            verificationState: true,
            freshness: { select: { reviewDueAt: true, staleAt: true } },
          },
        },
        extractionCandidates: {
          where: { status: 'PENDING' },
          select: { section: true, fieldKey: true, extractedValue: true },
        },
        sourceUrls: { where: { authorityStatus: 'VERIFIED' }, select: { id: true } },
        _count: { select: { properties: true } },
      },
    }),
    db.parcelResearchRequest.groupBy({ by: ['fipsCounty'], _count: { _all: true } }),
  ])
  const requestsByFips = new Map(requestGroups.map(row => [row.fipsCounty, row._count._all]))
  const rows = jurisdictions.map(jurisdiction => summarizeJurisdictionCoverage({
    id: jurisdiction.id,
    state: jurisdiction.state,
    county: jurisdiction.county,
    isAvailable: jurisdiction.isAvailable,
    profile: jurisdiction.profile,
    activeClaims: jurisdiction.claims,
    pendingCandidates: jurisdiction.extractionCandidates,
    verifiedSourceCount: jurisdiction.sourceUrls.length,
    trackedPropertyCount: jurisdiction._count.properties,
    researchRequestCount: jurisdiction.fips ? requestsByFips.get(jurisdiction.fips) ?? 0 : 0,
  }))
  const demandedCount = rows.filter(row => row.trackedPropertyCount + row.researchRequestCount > 0).length
  const totals = rows.reduce((sum, row) => ({
    claims: sum.claims + row.claimBackedFieldCount,
    legacy: sum.legacy + row.legacyFieldCount,
    verifiedSources: sum.verifiedSources + row.verifiedSourceCount,
  }), { claims: 0, legacy: 0, verifiedSources: 0 })
  const states = [...new Set(rows.map(row => row.state))].sort()
  const filtered = rows
    .filter(row => !params.state || row.state === params.state)
    .filter(row => {
      if (view === 'demanded') return row.trackedPropertyCount + row.researchRequestCount > 0
      if (view === 'no-claims') return row.claimBackedFieldCount === 0
      if (view === 'unsafe') return row.staleClaimCount + row.blockedClaimCount > 0
      return true
    })
    .sort(compareJurisdictionCoveragePriority)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Jurisdiction Coverage</h1>
        <p className="mt-1 text-sm text-zinc-500">Decision-grade coverage and legacy migration debt. Demand is prioritized before registry breadth.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Metric label="Registry counties" value={rows.length} />
        <Metric label="Demanded counties" value={demandedCount} />
        <Metric label="Claim-backed fields" value={totals.claims} />
        <Metric label="Legacy fields" value={totals.legacy} />
        <Metric label="Verified authorities" value={totals.verifiedSources} />
      </div>
      <form className="flex flex-wrap gap-3 rounded-xl border border-zinc-200 bg-white p-4" method="get">
        <select aria-label="State" name="state" defaultValue={params.state ?? ''} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm">
          <option value="">All states</option>
          {states.map(state => <option key={state} value={state}>{state}</option>)}
        </select>
        <select aria-label="Coverage view" name="view" defaultValue={view} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm">
          <option value="demanded">Demanded first</option>
          <option value="no-claims">No active claims</option>
          <option value="unsafe">Stale or blocked</option>
          <option value="all">All counties</option>
        </select>
        <button className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white" type="submit">Apply</button>
      </form>
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500"><tr>
            <th className="px-3 py-3">County</th><th className="px-3 py-3">Demand</th><th className="px-3 py-3">Claims</th>
            <th className="px-3 py-3">Critical legacy</th><th className="px-3 py-3">Catalog gaps</th><th className="px-3 py-3">Unsafe</th>
            <th className="px-3 py-3">Pending</th><th className="px-3 py-3">Authorities</th>
          </tr></thead>
          <tbody className="divide-y divide-zinc-100">
            {filtered.slice(0, 250).map(row => <tr key={row.id}>
              <td className="px-3 py-3"><Link className="font-medium text-blue-700 hover:underline" href={`/admin/rules/${row.id}`}>{row.county}, {row.state}</Link></td>
              <td className="px-3 py-3">{row.researchRequestCount} requests · {row.trackedPropertyCount} properties</td>
              <td className="px-3 py-3">{row.claimBackedFieldCount}</td><td className="px-3 py-3">{row.criticalUntrustedFieldCount}</td>
              <td className="px-3 py-3">{row.catalogGapCount}</td><td className="px-3 py-3">{row.staleClaimCount} stale · {row.blockedClaimCount} blocked</td>
              <td className="px-3 py-3">{row.pendingCandidateCount}</td><td className="px-3 py-3">{row.verifiedSourceCount}</td>
            </tr>)}
          </tbody>
        </table>
        <p className="border-t border-zinc-200 px-4 py-3 text-xs text-zinc-500">Showing {Math.min(filtered.length, 250)} of {filtered.length}. Legacy and invalid projections never count as coverage.</p>
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border border-zinc-200 bg-white p-4"><p className="text-xs font-medium uppercase text-zinc-500">{label}</p><p className="mt-2 text-2xl font-bold text-zinc-900">{value.toLocaleString()}</p></div>
}
