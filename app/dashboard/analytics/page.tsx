import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'

export const metadata = { title: 'Portfolio Analytics — Metis' }

function fmt$(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`
  return `$${Math.round(n).toLocaleString()}`
}

const STRATEGY_LABELS: Record<string, string> = {
  FIX_FLIP: 'Fix & Flip',
  BUY_HOLD: 'Buy & Hold',
  MULTIFAMILY: 'Multifamily',
  WHOLESALE: 'Wholesale',
  LAND: 'Land',
  TAX_LIEN: 'Tax Lien',
  TAX_DEED: 'Tax Deed',
  FORECLOSURE: 'Foreclosure',
}

const CLOSED_STATUSES = new Set(['SOLD', 'CLOSED', 'DEEDED', 'REDEEMED'])
const ACTIVE_STATUSES = new Set(['ACTIVE'])
const PIPELINE_STATUSES = new Set(['LEAD', 'ACTIVE'])

export default async function AnalyticsPage() {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) redirect('/sign-in')

  const tenant = await db.tenant.findUnique({ where: { clerkOrgId: orgId } })
  if (!tenant) redirect('/sign-in')

  const deals = await db.deal.findMany({
    where: { tenantId: tenant.id },
    select: {
      id: true,
      strategyType: true,
      status: true,
      purchasePrice: true,
      purchaseDate: true,
      exitPrice: true,
      exitDate: true,
      createdAt: true,
      fixFlip: {
        select: {
          arv: true,
          rehabBudget: true,
          rehabActualCost: true,
          closingDate: true,
        },
      },
      buyHold: {
        select: {
          actualMonthlyRent: true,
          targetMonthlyRent: true,
          hapMonthlyAmount: true,
          tenantPortion: true,
        },
      },
      multifamily: {
        select: {
          netOperatingIncome: true,
          capRate: true,
          unitCount: true,
          averageMonthlyRent: true,
          occupiedUnits: true,
        },
      },
      wholesale: {
        select: {
          assignmentFee: true,
          leadSource: true,
        },
      },
      landNotes: {
        where: { status: 'ACTIVE' },
        select: { balance: true, interestRate: true, paymentAmount: true },
      },
      mfLpInvestors: {
        select: { committedAmount: true, fundedAmount: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const total = deals.length

  // ── Acquisition funnel (all strategies) ───────────────────────
  const byStatus: Record<string, number> = {}
  for (const d of deals) {
    byStatus[d.status] = (byStatus[d.status] ?? 0) + 1
  }
  const leads = byStatus['LEAD'] ?? 0
  const active = byStatus['ACTIVE'] ?? 0
  const closedCount = deals.filter(d => CLOSED_STATUSES.has(d.status)).length
  const lostCount = byStatus['NOT_WON'] ?? 0

  // ── Capital deployed ──────────────────────────────────────────
  const totalCapitalDeployed = deals
    .filter(d => ACTIVE_STATUSES.has(d.status) || CLOSED_STATUSES.has(d.status))
    .reduce((s, d) => s + (d.purchasePrice ? Number(d.purchasePrice) : 0), 0)

  // ── Strategy breakdown ────────────────────────────────────────
  const byStrategy: Record<string, { total: number; active: number; closed: number; pipeline: number }> = {}
  for (const d of deals) {
    if (!byStrategy[d.strategyType]) byStrategy[d.strategyType] = { total: 0, active: 0, closed: 0, pipeline: 0 }
    const b = byStrategy[d.strategyType]
    b.total++
    if (CLOSED_STATUSES.has(d.status)) b.closed++
    if (ACTIVE_STATUSES.has(d.status)) b.active++
    if (PIPELINE_STATUSES.has(d.status)) b.pipeline++
  }

  // ── Fix & Flip analytics ──────────────────────────────────────
  const ffDeals = deals.filter(d => d.strategyType === 'FIX_FLIP')
  const ffClosed = ffDeals.filter(d => CLOSED_STATUSES.has(d.status))
  let ffTotalPnl = 0
  let ffRoiSum = 0
  let ffRoiCount = 0
  let ffRehabVarianceSum = 0
  let ffRehabVarianceCount = 0
  for (const d of ffClosed) {
    const buy = d.purchasePrice ? Number(d.purchasePrice) : 0
    const sell = d.exitPrice ? Number(d.exitPrice) : (d.fixFlip?.arv ? Number(d.fixFlip.arv) : null)
    const rehab = d.fixFlip?.rehabActualCost ? Number(d.fixFlip.rehabActualCost) :
                  d.fixFlip?.rehabBudget ? Number(d.fixFlip.rehabBudget) : 0
    if (sell && buy > 0) {
      const pnl = sell - buy - rehab
      ffTotalPnl += pnl
      ffRoiSum += ((pnl / (buy + rehab)) * 100)
      ffRoiCount++
    }
    if (d.fixFlip?.rehabBudget && d.fixFlip?.rehabActualCost) {
      const variance = Number(d.fixFlip.rehabActualCost) - Number(d.fixFlip.rehabBudget)
      ffRehabVarianceSum += variance
      ffRehabVarianceCount++
    }
  }
  const ffAvgRoi = ffRoiCount > 0 ? ffRoiSum / ffRoiCount : null
  const ffAvgRehabVariance = ffRehabVarianceCount > 0 ? ffRehabVarianceSum / ffRehabVarianceCount : null

  // ── Buy & Hold analytics ──────────────────────────────────────
  const bhActive = deals.filter(d => d.strategyType === 'BUY_HOLD' && ACTIVE_STATUSES.has(d.status))
  const bhMonthlyRent = bhActive.reduce((s, d) => {
    const rent = d.buyHold?.actualMonthlyRent ? Number(d.buyHold.actualMonthlyRent) :
                 d.buyHold?.targetMonthlyRent ? Number(d.buyHold.targetMonthlyRent) : 0
    return s + rent
  }, 0)
  const bhInvested = bhActive.reduce((s, d) => s + (d.purchasePrice ? Number(d.purchasePrice) : 0), 0)
  const bhGrossYield = bhInvested > 0 ? ((bhMonthlyRent * 12) / bhInvested) * 100 : null

  // ── Multifamily analytics ─────────────────────────────────────
  const mfActive = deals.filter(d => d.strategyType === 'MULTIFAMILY' && ACTIVE_STATUSES.has(d.status))
  const mfNoi = mfActive.reduce((s, d) => s + (d.multifamily?.netOperatingIncome ? Number(d.multifamily.netOperatingIncome) : 0), 0)
  const mfCapRates = mfActive.filter(d => d.multifamily?.capRate).map(d => Number(d.multifamily!.capRate))
  const mfAvgCapRate = mfCapRates.length > 0 ? mfCapRates.reduce((a, b) => a + b, 0) / mfCapRates.length : null
  const mfTotalUnits = mfActive.reduce((s, d) => s + (d.multifamily?.unitCount ?? 0), 0)
  const mfLpCommitted = deals
    .filter(d => d.strategyType === 'MULTIFAMILY')
    .flatMap(d => d.mfLpInvestors)
    .reduce((s, inv) => s + Number(inv.committedAmount), 0)
  const mfLpFunded = deals
    .filter(d => d.strategyType === 'MULTIFAMILY')
    .flatMap(d => d.mfLpInvestors)
    .reduce((s, inv) => s + Number(inv.fundedAmount), 0)

  // ── Land Note analytics ───────────────────────────────────────
  const allNotes = deals.flatMap(d => d.landNotes)
  const noteBalance = allNotes.reduce((s, n) => s + Number(n.balance), 0)
  const noteMonthlyPayments = allNotes.reduce((s, n) => s + Number(n.paymentAmount), 0)
  const noteAvgRate = allNotes.length > 0
    ? (allNotes.reduce((s, n) => s + Number(n.interestRate), 0) / allNotes.length) * 100
    : null

  // ── Wholesale analytics ───────────────────────────────────────
  const wsDeals = deals.filter(d => d.strategyType === 'WHOLESALE')
  const wsClosed = wsDeals.filter(d => CLOSED_STATUSES.has(d.status))
  const wsWithFee = wsClosed.filter(d => d.wholesale?.assignmentFee != null)
  const wsAvgFee = wsWithFee.length > 0
    ? wsWithFee.reduce((s, d) => s + Number(d.wholesale!.assignmentFee), 0) / wsWithFee.length
    : null
  const wsCloseRate = wsDeals.length > 0 ? (wsClosed.length / wsDeals.length) * 100 : null
  const wsTotalFees = wsClosed.reduce((s, d) => s + (d.wholesale?.assignmentFee ? Number(d.wholesale.assignmentFee) : 0), 0)

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-zinc-900">Portfolio Analytics</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Cross-strategy performance across {total} deal{total !== 1 ? 's' : ''}</p>
      </div>

      {total === 0 ? (
        <p className="text-sm text-zinc-400 text-center py-16">No deals yet. Add your first deal to start tracking.</p>
      ) : (
        <>
          {/* ── Portfolio overview ─────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            <MetricCard label="Total deals" value={String(total)} />
            <MetricCard label="In pipeline" value={String(leads + active)} sub={`${leads} leads · ${active} active`} />
            <MetricCard label="Closed / won" value={String(closedCount)} />
            <MetricCard
              label="Capital deployed"
              value={totalCapitalDeployed > 0 ? fmt$(totalCapitalDeployed) : '—'}
            />
          </div>

          {/* ── Acquisition funnel ─────────────────────────────── */}
          <Section title="Acquisition Funnel">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 divide-x divide-zinc-100">
              <FunnelCell label="Leads" count={leads} of={total} color="bg-sky-400" />
              <FunnelCell label="Active" count={active} of={total} color="bg-violet-500" />
              <FunnelCell label="Closed" count={closedCount} of={total} color="bg-emerald-500" />
              <FunnelCell label="Dead" count={lostCount} of={total} color="bg-zinc-300" />
            </div>
          </Section>

          {/* ── Strategy breakdown ─────────────────────────────── */}
          {Object.keys(byStrategy).length > 1 && (
            <Section title="Deals by Strategy">
              <div className="space-y-2.5">
                {Object.entries(byStrategy)
                  .sort((a, b) => b[1].total - a[1].total)
                  .map(([st, counts]) => (
                    <div key={st} className="flex items-center gap-3 text-sm">
                      <span className="w-32 shrink-0 text-zinc-600">{STRATEGY_LABELS[st] ?? st}</span>
                      <div className="flex-1 h-2 bg-zinc-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-violet-500 rounded-full"
                          style={{ width: `${Math.round((counts.pipeline / total) * 100)}%` }}
                        />
                      </div>
                      <span className="w-24 text-right text-zinc-500">
                        {counts.total} total · {counts.closed} closed
                      </span>
                    </div>
                  ))}
              </div>
            </Section>
          )}

          {/* ── Fix & Flip ────────────────────────────────────── */}
          {ffDeals.length > 0 && (
            <Section title="Fix & Flip">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <MetricCard label="Total deals" value={String(ffDeals.length)} />
                <MetricCard label="Closed" value={String(ffClosed.length)} />
                <MetricCard
                  label="Avg ROI"
                  value={ffAvgRoi != null ? `${ffAvgRoi.toFixed(1)}%` : '—'}
                  className={ffAvgRoi != null && ffAvgRoi >= 20 ? 'border-emerald-200' : ''}
                />
                <MetricCard
                  label="Total realized P&L"
                  value={ffClosed.length > 0 ? fmt$(ffTotalPnl) : '—'}
                  className={ffTotalPnl > 0 ? 'border-emerald-200' : ffTotalPnl < 0 ? 'border-red-200' : ''}
                />
              </div>
              {ffAvgRehabVariance != null && (
                <p className="text-xs text-zinc-400 mt-3">
                  Avg rehab variance (actual vs budget):{' '}
                  <span className={ffAvgRehabVariance > 0 ? 'text-red-600' : 'text-emerald-600'}>
                    {ffAvgRehabVariance > 0 ? '+' : ''}{fmt$(ffAvgRehabVariance)}
                  </span>
                  {' '}over {ffRehabVarianceCount} closed deal{ffRehabVarianceCount !== 1 ? 's' : ''}
                </p>
              )}
            </Section>
          )}

          {/* ── Buy & Hold ───────────────────────────────────── */}
          {bhActive.length > 0 && (
            <Section title="Buy & Hold">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <MetricCard label="Active rentals" value={String(bhActive.length)} />
                <MetricCard
                  label="Monthly rent roll"
                  value={bhMonthlyRent > 0 ? fmt$(bhMonthlyRent) : '—'}
                />
                <MetricCard
                  label="Annual rent"
                  value={bhMonthlyRent > 0 ? fmt$(bhMonthlyRent * 12) : '—'}
                />
                <MetricCard
                  label="Gross yield"
                  value={bhGrossYield != null ? `${bhGrossYield.toFixed(1)}%` : '—'}
                  className={bhGrossYield != null && bhGrossYield >= 8 ? 'border-emerald-200' : ''}
                />
              </div>
              {bhInvested > 0 && (
                <p className="text-xs text-zinc-400 mt-3">
                  Total invested in active rentals: {fmt$(bhInvested)}
                </p>
              )}
            </Section>
          )}

          {/* ── Multifamily ──────────────────────────────────── */}
          {mfActive.length > 0 && (
            <Section title="Multifamily">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <MetricCard label="Active properties" value={String(mfActive.length)} />
                <MetricCard label="Total units" value={mfTotalUnits > 0 ? String(mfTotalUnits) : '—'} />
                <MetricCard
                  label="Portfolio NOI"
                  value={mfNoi > 0 ? fmt$(mfNoi) : '—'}
                  sub="annual"
                />
                <MetricCard
                  label="Avg cap rate"
                  value={mfAvgCapRate != null ? `${(mfAvgCapRate * 100).toFixed(1)}%` : '—'}
                  className={mfAvgCapRate != null && mfAvgCapRate >= 0.06 ? 'border-emerald-200' : ''}
                />
              </div>
              {(mfLpCommitted > 0 || mfLpFunded > 0) && (
                <div className="mt-4 pt-4 border-t border-zinc-100 grid grid-cols-2 gap-4">
                  <MetricCard label="LP committed" value={fmt$(mfLpCommitted)} />
                  <MetricCard
                    label="LP funded"
                    value={fmt$(mfLpFunded)}
                    sub={mfLpCommitted > 0 ? `${Math.round((mfLpFunded / mfLpCommitted) * 100)}% called` : undefined}
                  />
                </div>
              )}
            </Section>
          )}

          {/* ── Land Notes ───────────────────────────────────── */}
          {allNotes.length > 0 && (
            <Section title="Land Note Servicing">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <MetricCard label="Active notes" value={String(allNotes.length)} />
                <MetricCard label="Balance outstanding" value={noteBalance > 0 ? fmt$(noteBalance) : '—'} />
                <MetricCard
                  label="Monthly payments"
                  value={noteMonthlyPayments > 0 ? fmt$(noteMonthlyPayments) : '—'}
                />
                <MetricCard
                  label="Avg interest rate"
                  value={noteAvgRate != null ? `${noteAvgRate.toFixed(1)}%` : '—'}
                />
              </div>
              {noteMonthlyPayments > 0 && (
                <p className="text-xs text-zinc-400 mt-3">
                  Projected annual note income: {fmt$(noteMonthlyPayments * 12)}
                </p>
              )}
            </Section>
          )}

          {/* ── Wholesale ────────────────────────────────────── */}
          {wsDeals.length > 0 && (
            <Section title="Wholesale">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <MetricCard label="Total deals" value={String(wsDeals.length)} />
                <MetricCard label="Closed" value={String(wsClosed.length)} />
                <MetricCard
                  label="Close rate"
                  value={wsCloseRate != null ? `${wsCloseRate.toFixed(1)}%` : '—'}
                  className={wsCloseRate != null && wsCloseRate >= 30 ? 'border-emerald-200' : ''}
                />
                <MetricCard
                  label="Avg assignment fee"
                  value={wsAvgFee != null ? fmt$(wsAvgFee) : '—'}
                />
              </div>
              {wsTotalFees > 0 && (
                <p className="text-xs text-zinc-400 mt-3">
                  Total assignment fees collected: {fmt$(wsTotalFees)}
                </p>
              )}
            </Section>
          )}
        </>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-6 mb-6">
      <h2 className="text-sm font-semibold text-zinc-900 mb-4">{title}</h2>
      {children}
    </div>
  )
}

function FunnelCell({ label, count, of: total, color }: { label: string; count: number; of: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className="px-4 py-4 first:pl-0 last:pr-0 text-center">
      <div className="text-xl font-bold text-zinc-900 mb-0.5">{count}</div>
      <div className="text-xs text-zinc-500 mb-2">{label}</div>
      <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden mx-auto max-w-15">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <div className="text-xs text-zinc-400 mt-1">{pct}%</div>
    </div>
  )
}

function MetricCard({ label, value, sub, className }: { label: string; value: string; sub?: string; className?: string }) {
  return (
    <div className={`bg-zinc-50 rounded-lg border border-zinc-200 px-4 py-3 ${className ?? ''}`}>
      <div className="text-xs text-zinc-400 mb-0.5">{label}</div>
      <div className="text-lg font-bold text-zinc-900">{value}</div>
      {sub && <div className="text-xs text-zinc-400 mt-0.5">{sub}</div>}
    </div>
  )
}
