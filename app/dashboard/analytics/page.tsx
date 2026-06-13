import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { hasTier } from '@/lib/entitlements'

export const metadata = { title: 'Pipeline Analytics — Metis' }

type Stage = { label: string; count: number; pct?: number }
type LeadSourceRow = { source: string; total: number; closed: number; closeRate: number; avgFee: number | null }

export default async function AnalyticsPage() {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) redirect('/sign-in')

  const tenant = await db.tenant.findUnique({ where: { clerkOrgId: orgId } })
  if (!tenant) redirect('/sign-in')

  const hasPremium = await hasTier(tenant.id, 'WHOLESALE', 'PREMIUM')

  const rawDeals = await db.deal.findMany({
    where: { tenantId: tenant.id, strategyType: 'WHOLESALE' },
    include: { wholesale: { select: { leadSource: true, assignmentFee: true, dispositionStatus: true } } },
    orderBy: { createdAt: 'desc' },
  })

  const total = rawDeals.length

  // Stage counts
  const stageCounts: Record<string, number> = {
    LEAD:    0,
    ACTIVE:  0,
    SOLD:    0,
    NOT_WON: 0,
  }
  for (const d of rawDeals) stageCounts[d.status] = (stageCounts[d.status] ?? 0) + 1

  const stages: Stage[] = [
    { label: 'Leads',          count: stageCounts['LEAD'] ?? 0 },
    { label: 'Under Contract', count: stageCounts['ACTIVE'] ?? 0 },
    { label: 'Closed',         count: stageCounts['SOLD'] ?? 0 },
    { label: 'Dead Leads',     count: stageCounts['NOT_WON'] ?? 0 },
  ].map(s => ({ ...s, pct: total > 0 ? Math.round((s.count / total) * 100) : 0 }))

  const closedDeals = rawDeals.filter(d => d.status === 'SOLD')
  const withFee = closedDeals.filter(d => d.wholesale?.assignmentFee != null)
  const avgFee = withFee.length > 0
    ? withFee.reduce((sum, d) => sum + Number(d.wholesale!.assignmentFee), 0) / withFee.length
    : null
  const closeRate = total > 0 ? ((closedDeals.length / total) * 100).toFixed(1) : '0.0'

  // Lead source analytics
  const bySource = new Map<string, { total: number; closed: number; fees: number[] }>()
  for (const d of rawDeals) {
    const src = d.wholesale?.leadSource ?? 'Unknown'
    if (!bySource.has(src)) bySource.set(src, { total: 0, closed: 0, fees: [] })
    const row = bySource.get(src)!
    row.total++
    if (d.status === 'SOLD') {
      row.closed++
      if (d.wholesale?.assignmentFee != null) row.fees.push(Number(d.wholesale.assignmentFee))
    }
  }

  const leadSourceRows: LeadSourceRow[] = Array.from(bySource.entries())
    .map(([source, { total: t, closed, fees }]) => ({
      source,
      total: t,
      closed,
      closeRate: t > 0 ? (closed / t) * 100 : 0,
      avgFee: fees.length > 0 ? fees.reduce((a, b) => a + b, 0) / fees.length : null,
    }))
    .sort((a, b) => b.total - a.total)

  // Disposition funnel (for ACTIVE deals)
  const dispCounts: Record<string, number> = {}
  for (const d of rawDeals.filter(x => x.status === 'ACTIVE')) {
    const disp = d.wholesale?.dispositionStatus ?? 'None'
    dispCounts[disp] = (dispCounts[disp] ?? 0) + 1
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Wholesale Analytics</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Pipeline performance across all wholesale deals</p>
        </div>
        {!hasPremium && (
          <div className="text-xs text-zinc-400 bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2">
            Upgrade to Wholesale PREMIUM for buyer blast campaigns
          </div>
        )}
      </div>

      {total === 0 ? (
        <p className="text-sm text-zinc-400 text-center py-16">No wholesale deals yet.</p>
      ) : (
        <>
          {/* Top metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            <MetricCard label="Total deals" value={String(total)} />
            <MetricCard label="Closed" value={String(closedDeals.length)} />
            <MetricCard label="Close rate" value={`${closeRate}%`}
              className={Number(closeRate) >= 30 ? 'border-emerald-200' : ''} />
            <MetricCard
              label="Avg assignment fee"
              value={avgFee != null ? `$${Math.round(avgFee).toLocaleString()}` : '—'}
            />
          </div>

          {/* Stage funnel */}
          <div className="bg-white rounded-xl border border-zinc-200 p-6 mb-6">
            <h2 className="text-sm font-semibold text-zinc-900 mb-4">Pipeline by Stage</h2>
            <div className="space-y-3">
              {stages.map(s => (
                <div key={s.label}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-zinc-600">{s.label}</span>
                    <span className="font-medium text-zinc-900">{s.count} <span className="text-zinc-400 font-normal">({s.pct}%)</span></span>
                  </div>
                  <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                    <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${s.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Lead source table */}
          {leadSourceRows.length > 0 && (
            <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden mb-6">
              <div className="px-6 py-4 border-b border-zinc-100">
                <h2 className="text-sm font-semibold text-zinc-900">By Lead Source</h2>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 border-b border-zinc-100">
                  <tr>
                    <th className="text-left px-6 py-3 text-xs font-medium text-zinc-500">Source</th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-zinc-500">Total</th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-zinc-500">Closed</th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-zinc-500">Close Rate</th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-zinc-500">Avg Fee</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {leadSourceRows.map(r => (
                    <tr key={r.source} className="hover:bg-zinc-50 transition-colors">
                      <td className="px-6 py-3 font-medium text-zinc-800">{r.source}</td>
                      <td className="px-6 py-3 text-right text-zinc-600">{r.total}</td>
                      <td className="px-6 py-3 text-right text-zinc-600">{r.closed}</td>
                      <td className="px-6 py-3 text-right">
                        <span className={r.closeRate >= 30 ? 'text-emerald-700 font-medium' : 'text-zinc-600'}>
                          {r.closeRate.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right text-zinc-600">
                        {r.avgFee != null ? `$${Math.round(r.avgFee).toLocaleString()}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function MetricCard({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-zinc-200 px-4 py-3 ${className ?? ''}`}>
      <div className="text-xs text-zinc-400 mb-0.5">{label}</div>
      <div className="text-lg font-bold text-zinc-900">{value}</div>
    </div>
  )
}
