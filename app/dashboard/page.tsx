import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { syncUserToDatabase } from '@/lib/sync-user'
import { db } from '@/lib/db'
import { DealStatus, EventStatus, StrategyType } from '@/app/generated/prisma'
import { parseOptionalStrategyParam, getStrategyMeta, ALL_STRATEGIES, type StrategyKey } from '@/lib/strategy-meta'
import { TRANSACTION_DIRECTION } from '@/lib/transactions'
import { getEnabledStrategies } from '@/lib/entitlements'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EventRow = {
  id: string
  dealId: string
  label: string
  dueDate: Date
  deal: { strategyType: StrategyType; property: { apn: string; address: string | null } }
}

type StrategyRow = {
  key: StrategyKey
  navLabel: string
  statusCounts: Partial<Record<DealStatus, number>>
  totalDeals: number
  capitalDeployed: number
  overdueCount: number
  realizedPnl: number
}

// Display order + short labels for status chips on the portfolio table.
const STATUS_CHIPS: { status: DealStatus; label: string; cls: string }[] = [
  { status: 'LEAD',                  label: 'Lead',        cls: 'bg-sky-100 text-sky-700' },
  { status: 'ACTIVE',                label: 'Active',      cls: 'bg-emerald-100 text-emerald-700' },
  { status: 'NOT_WON',               label: 'Not Won',     cls: 'bg-zinc-100 text-zinc-500' },
  { status: 'REDEEMED',              label: 'Redeemed',    cls: 'bg-violet-100 text-violet-700' },
  { status: 'FORECLOSURE_INITIATED', label: 'Foreclosure', cls: 'bg-orange-100 text-orange-700' },
  { status: 'DEEDED',                label: 'Deeded',      cls: 'bg-amber-100 text-amber-700' },
  { status: 'SOLD',                  label: 'Sold',        cls: 'bg-zinc-100 text-zinc-600' },
  { status: 'CLOSED',                label: 'Closed',      cls: 'bg-zinc-100 text-zinc-600' },
  { status: 'EXPIRED',               label: 'Expired',     cls: 'bg-zinc-100 text-zinc-500' },
]

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ strategy?: string }>
}) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) redirect('/sign-in')

  const synced = await syncUserToDatabase()
  if (!synced) redirect('/onboarding')

  const { tenant } = synced
  const tenantId = tenant.id

  const { strategy: strategyParam } = await searchParams
  const strategyKey = parseOptionalStrategyParam(strategyParam)

  return strategyKey === null
    ? <PortfolioDashboard tenantId={tenantId} />
    : <StrategyDashboard tenantId={tenantId} strategyKey={strategyKey} />
}

// ---------------------------------------------------------------------------
// Portfolio hub — cross-strategy view (default)
// ---------------------------------------------------------------------------

async function PortfolioDashboard({ tenantId }: { tenantId: string }) {
  const now = new Date()
  const in7d  = new Date(now.getTime() + 7  * 86_400_000)
  const in30d = new Date(now.getTime() + 30 * 86_400_000)

  const include = { deal: { select: { strategyType: true, property: { select: { apn: true, address: true } } } } } as const

  const [statusGroups, overdueEvents, urgentEvents, upcomingEvents,
         lienSum, deedSum, foreclosureSum, purchaseSums, allTxs] = await Promise.all([
    db.deal.groupBy({ by: ['strategyType', 'status'], where: { tenantId }, _count: true }),
    db.event.findMany({ where: { status: EventStatus.OVERDUE,  deal: { tenantId } }, include, orderBy: { dueDate: 'asc' }, take: 15 }),
    db.event.findMany({ where: { status: EventStatus.PENDING,  dueDate: { lte: in7d  }, deal: { tenantId } }, include, orderBy: { dueDate: 'asc' }, take: 15 }),
    db.event.findMany({ where: { status: EventStatus.PENDING,  dueDate: { gt: in7d, lte: in30d }, deal: { tenantId } }, include, orderBy: { dueDate: 'asc' }, take: 15 }),
    // Capital deployed = cost basis: lien face amount, deed/foreclosure winning
    // bid, generic purchase price for the rest. Never ARV/rent/NOI here.
    db.dealTaxLien.aggregate({ where: { deal: { tenantId } }, _sum: { faceAmount: true } }),
    db.dealTaxDeed.aggregate({ where: { deal: { tenantId } }, _sum: { winningBid: true } }),
    db.dealForeclosure.aggregate({ where: { deal: { tenantId } }, _sum: { winningBid: true } }),
    db.deal.groupBy({
      by: ['strategyType'],
      where: { tenantId, strategyType: { notIn: [StrategyType.TAX_LIEN, StrategyType.TAX_DEED, StrategyType.FORECLOSURE] } },
      _sum: { purchasePrice: true },
    }),
    db.financialTransaction.findMany({
      where: { tenantId },
      select: { type: true, amount: true, date: true, deal: { select: { strategyType: true } } },
    }),
  ])

  const capitalByStrategy: Partial<Record<StrategyKey, number>> = {
    TAX_LIEN:    Number(lienSum._sum.faceAmount ?? 0),
    TAX_DEED:    Number(deedSum._sum.winningBid ?? 0),
    FORECLOSURE: Number(foreclosureSum._sum.winningBid ?? 0),
  }
  for (const g of purchaseSums) capitalByStrategy[g.strategyType] = Number(g._sum.purchasePrice ?? 0)

  // Compute realized P&L per strategy from the ledger
  const pnlByStrategy: Partial<Record<StrategyKey, number>> = {}
  let totalRealizedPnl = 0
  for (const tx of allTxs) {
    const key = tx.deal.strategyType as StrategyKey
    if (!(key in pnlByStrategy)) pnlByStrategy[key] = 0
    const dir = TRANSACTION_DIRECTION[tx.type]
    pnlByStrategy[key]! += dir === 'IN' ? Number(tx.amount) : -Number(tx.amount)
    totalRealizedPnl    += dir === 'IN' ? Number(tx.amount) : -Number(tx.amount)
  }

  // Per-strategy overdue counts for the table rows (events relate to strategy
  // through deal, which groupBy cannot traverse).
  const strategiesWithDeals = [...new Set(statusGroups.map(g => g.strategyType))]
  const overdueCounts = await Promise.all(
    strategiesWithDeals.map(s =>
      db.event.count({ where: { status: EventStatus.OVERDUE, deal: { tenantId, strategyType: s } } })),
  )
  const overdueByStrategy = Object.fromEntries(strategiesWithDeals.map((s, i) => [s, overdueCounts[i]]))

  const rows: StrategyRow[] = ALL_STRATEGIES
    .filter(m => strategiesWithDeals.includes(m.key))
    .map(m => {
      const groups = statusGroups.filter(g => g.strategyType === m.key)
      return {
        key: m.key,
        navLabel: m.navLabel,
        statusCounts: Object.fromEntries(groups.map(g => [g.status, g._count])),
        totalDeals: groups.reduce((n, g) => n + g._count, 0),
        capitalDeployed: capitalByStrategy[m.key] ?? 0,
        overdueCount: overdueByStrategy[m.key] ?? 0,
        realizedPnl: pnlByStrategy[m.key] ?? 0,
      }
    })

  const enabledStrategyKeys = new Set(await getEnabledStrategies(tenantId))
  const unusedStrategies = ALL_STRATEGIES.filter(m => !strategiesWithDeals.includes(m.key))
  const totalActive  = statusGroups.filter(g => g.status === 'ACTIVE').reduce((n, g) => n + g._count, 0)
  const totalCapital = Object.values(capitalByStrategy).reduce((a, b) => a + b, 0)
  const hasDeals     = statusGroups.length > 0

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900">Portfolio</h1>
      </div>

      {hasDeals ? (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            <StatCard label="Active Deals"     value={totalActive} />
            <StatCard label="Capital Deployed" value={`$${totalCapital.toLocaleString()}`} />
            <StatCard label="Realized P&L"
              value={`${totalRealizedPnl >= 0 ? '+' : '-'}$${Math.abs(totalRealizedPnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              accent={totalRealizedPnl > 0 ? 'green' : totalRealizedPnl < 0 ? 'red' : undefined}
            />
            <StatCard label="Overdue"          value={overdueEvents.length} accent={overdueEvents.length > 0 ? 'red' : undefined} />
            <StatCard label="Due in 7 Days"    value={urgentEvents.length}  accent={urgentEvents.length  > 0 ? 'yellow' : undefined} />
          </div>

          {/* Your strategies */}
          <div className="mb-8 bg-white rounded-xl border border-zinc-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-100">
              <h2 className="text-sm font-semibold text-zinc-900">Your Strategies</h2>
            </div>
            <div className="divide-y divide-zinc-100">
              {rows.map(row => (
                <Link key={row.key} href={`/dashboard?strategy=${row.key}`}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-zinc-50 transition-colors">
                  <div className="w-32 flex-shrink-0">
                    <p className="text-sm font-medium text-zinc-900">{row.navLabel}</p>
                    <p className="text-xs text-zinc-400">{row.totalDeals} deal{row.totalDeals === 1 ? '' : 's'}</p>
                  </div>
                  <div className="flex-1 min-w-0 flex flex-wrap items-center gap-1.5">
                    {STATUS_CHIPS.filter(c => row.statusCounts[c.status]).map(c => (
                      <span key={c.status} className={`px-1.5 py-0.5 rounded text-xs font-medium ${c.cls}`}>
                        {row.statusCounts[c.status]} {c.label}
                      </span>
                    ))}
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-sm font-medium text-zinc-900">${row.capitalDeployed.toLocaleString()}</p>
                    {row.overdueCount > 0
                      ? <p className="text-xs font-medium text-red-600">{row.overdueCount} overdue</p>
                      : row.realizedPnl !== 0
                        ? <p className={`text-xs font-medium ${row.realizedPnl > 0 ? 'text-green-700' : 'text-red-700'}`}>
                            {row.realizedPnl > 0 ? '+' : '-'}${Math.abs(row.realizedPnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} realized
                          </p>
                        : <p className="text-xs text-zinc-400">deployed</p>}
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Deadline buckets — all strategies */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Bucket title="Overdue"        events={overdueEvents  as EventRow[]} color="red"    nowMs={now.getTime()} showStrategy />
            <Bucket title="Due in 7 Days"  events={urgentEvents   as EventRow[]} color="yellow" nowMs={now.getTime()} showStrategy />
            <Bucket title="Due in 30 Days" events={upcomingEvents as EventRow[]} color="blue"   nowMs={now.getTime()} showStrategy />
          </div>
        </>
      ) : (
        <div className="mb-8 text-center py-12 bg-white rounded-xl border border-zinc-200">
          <p className="text-zinc-500">Welcome to Metis. Pick a strategy below to add your first deal.</p>
        </div>
      )}

      {/* Expand your portfolio — strategies not in use yet */}
      {unusedStrategies.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-3">
            {hasDeals ? 'Expand Your Portfolio' : 'Strategies'}
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {unusedStrategies.map(m => {
              const isEnabled = enabledStrategyKeys.has(m.key)
              if (!m.creatable) {
                return (
                  <div key={m.key} className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 p-4">
                    <p className="text-sm font-medium text-zinc-400">{m.navLabel}</p>
                    <p className="text-xs text-zinc-400 mt-1">Coming soon</p>
                  </div>
                )
              }
              if (isEnabled) {
                return (
                  <Link key={m.key} href={`/dashboard/deals/new?strategy=${m.key}`}
                    className="rounded-xl border border-zinc-200 bg-white p-4 hover:border-blue-300 hover:shadow-sm transition-all">
                    <p className="text-sm font-medium text-zinc-900">{m.navLabel}</p>
                    <p className="text-xs text-blue-600 mt-1">{m.newLabel}</p>
                  </Link>
                )
              }
              return (
                <Link key={m.key} href="/dashboard/billing"
                  className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-4 hover:border-zinc-400 hover:bg-white transition-all group">
                  <p className="text-sm font-medium text-zinc-500 group-hover:text-zinc-900">{m.navLabel}</p>
                  <p className="text-xs text-zinc-400 mt-1 group-hover:text-blue-600">Unlock module</p>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Strategy drill-in — single-strategy view (?strategy=X)
// ---------------------------------------------------------------------------

async function StrategyDashboard({ tenantId, strategyKey }: { tenantId: string; strategyKey: StrategyKey }) {
  const meta = getStrategyMeta(strategyKey)
  const strategy = strategyKey as StrategyType

  const now = new Date()
  const in7d  = new Date(now.getTime() + 7  * 86_400_000)
  const in30d = new Date(now.getTime() + 30 * 86_400_000)

  const include = { deal: { select: { strategyType: true, property: { select: { apn: true, address: true } } } } } as const

  const [activeCount, overdueEvents, urgentEvents, upcomingEvents] = await Promise.all([
    db.deal.count({ where: { tenantId, strategyType: strategy, status: 'ACTIVE' } }),
    db.event.findMany({ where: { status: EventStatus.OVERDUE,  deal: { tenantId, strategyType: strategy } }, include, orderBy: { dueDate: 'asc' }, take: 15 }),
    db.event.findMany({ where: { status: EventStatus.PENDING,  dueDate: { lte: in7d  }, deal: { tenantId, strategyType: strategy } }, include, orderBy: { dueDate: 'asc' }, take: 15 }),
    db.event.findMany({ where: { status: EventStatus.PENDING,  dueDate: { gt: in7d, lte: in30d }, deal: { tenantId, strategyType: strategy } }, include, orderBy: { dueDate: 'asc' }, take: 15 }),
  ])

  // Strategy-specific headline number, labeled per strategy (ARV, rent and NOI
  // are not portfolio value — the cross-strategy aggregate lives on the hub).
  const totalValue = strategy === StrategyType.TAX_LIEN
    ? Number((await db.dealTaxLien.aggregate({ where: { deal: { tenantId } }, _sum: { faceAmount: true } }))._sum.faceAmount ?? 0)
    : strategy === StrategyType.TAX_DEED
      ? Number((await db.dealTaxDeed.aggregate({ where: { deal: { tenantId } }, _sum: { winningBid: true } }))._sum.winningBid ?? 0)
      : strategy === StrategyType.FORECLOSURE
        ? Number((await db.dealForeclosure.aggregate({ where: { deal: { tenantId } }, _sum: { winningBid: true } }))._sum.winningBid ?? 0)
        : strategy === StrategyType.FIX_FLIP
          ? Number((await db.dealFixFlip.aggregate({ where: { deal: { tenantId } }, _sum: { arv: true } }))._sum.arv ?? 0)
          : strategy === StrategyType.WHOLESALE
            ? Number((await db.dealWholesale.aggregate({ where: { deal: { tenantId } }, _sum: { contractPrice: true } }))._sum.contractPrice ?? 0)
            : strategy === StrategyType.BUY_HOLD
              ? Number((await db.dealBuyHold.aggregate({ where: { deal: { tenantId } }, _sum: { actualMonthlyRent: true } }))._sum.actualMonthlyRent ?? 0)
              : strategy === StrategyType.LAND
                ? Number((await db.deal.aggregate({ where: { tenantId, strategyType: strategy }, _sum: { purchasePrice: true } }))._sum.purchasePrice ?? 0)
                : strategy === StrategyType.MULTIFAMILY
                  ? Number((await db.dealMultifamily.aggregate({ where: { deal: { tenantId } }, _sum: { netOperatingIncome: true } }))._sum.netOperatingIncome ?? 0)
                  : 0

  const newDealHref = `/dashboard/deals/new?strategy=${strategy}`

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900">{meta.plural}</h1>
        {meta.creatable ? (
          <Link
            href={newDealHref}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <span>+</span> New {meta.label}
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-zinc-100 text-zinc-400 text-sm font-medium rounded-lg cursor-not-allowed">
            Coming Soon
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label={`Active ${meta.plural}`}     value={activeCount} />
        <StatCard label={`Total ${meta.amountCol}`}   value={`$${totalValue.toLocaleString()}`} />
        <StatCard label="Overdue"                     value={overdueEvents.length}  accent={overdueEvents.length > 0 ? 'red' : undefined} />
        <StatCard label="Due in 7 Days"               value={urgentEvents.length}   accent={urgentEvents.length  > 0 ? 'yellow' : undefined} />
      </div>

      {/* Deadline buckets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Bucket title="Overdue"        events={overdueEvents  as EventRow[]} color="red" nowMs={now.getTime()} />
        <Bucket title="Due in 7 Days"  events={urgentEvents   as EventRow[]} color="yellow" nowMs={now.getTime()} />
        <Bucket title="Due in 30 Days" events={upcomingEvents as EventRow[]} color="blue" nowMs={now.getTime()} />
      </div>

      {/* Empty state */}
      {activeCount === 0 && (
        <div className="mt-12 text-center py-16 bg-white rounded-xl border border-zinc-200">
          <p className="text-zinc-500 mb-4">No {meta.plural.toLowerCase()} yet. Add your first to see deadlines here.</p>
          {meta.creatable && (
            <Link
              href={newDealHref}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              + Add First {meta.label}
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: 'red' | 'yellow' | 'green' }) {
  const bg   = accent === 'red' ? 'bg-red-50 border-red-200' : accent === 'yellow' ? 'bg-yellow-50 border-yellow-200' : accent === 'green' ? 'bg-green-50 border-green-200' : 'bg-white border-zinc-200'
  const text = accent === 'red' ? 'text-red-700'             : accent === 'yellow' ? 'text-yellow-700'                 : accent === 'green' ? 'text-green-700'               : 'text-zinc-900'
  return (
    <div className={`rounded-xl border p-4 ${bg}`}>
      <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${text}`}>{value}</p>
    </div>
  )
}

function Bucket({ title, events, color, nowMs, showStrategy }: { title: string; events: EventRow[]; color: 'red' | 'yellow' | 'blue'; nowMs: number; showStrategy?: boolean }) {
  const styles = {
    red:    { border: 'border-red-200',    header: 'bg-red-50 text-red-800',       badge: 'bg-red-100 text-red-700' },
    yellow: { border: 'border-yellow-200', header: 'bg-yellow-50 text-yellow-800', badge: 'bg-yellow-100 text-yellow-700' },
    blue:   { border: 'border-blue-200',   header: 'bg-blue-50 text-blue-800',     badge: 'bg-blue-100 text-blue-700' },
  }[color]

  return (
    <div className={`rounded-xl border ${styles.border} overflow-hidden`}>
      <div className={`px-4 py-3 flex items-center justify-between ${styles.header}`}>
        <span className="text-sm font-semibold">{title}</span>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${styles.badge}`}>{events.length}</span>
      </div>
      <div className="divide-y divide-zinc-100 bg-white">
        {events.length === 0 ? (
          <p className="px-4 py-8 text-sm text-zinc-400 text-center">None</p>
        ) : (
          events.map(ev => {
            const days = Math.round((ev.dueDate.getTime() - nowMs) / 86_400_000)
            const dayLabel = days < 0 ? `${Math.abs(days)}d overdue` : `${days}d remaining`
            const dayColor = days < 0 ? 'text-red-600' : days <= 7 ? 'text-yellow-600' : 'text-blue-600'
            return (
              <Link key={ev.id} href={`/dashboard/deals/${ev.dealId}`} className="flex flex-col px-4 py-3 hover:bg-zinc-50 text-sm transition-colors">
                <span className="flex items-center gap-2 min-w-0">
                  <span className="font-medium text-zinc-900 truncate">{ev.deal.property.apn}</span>
                  {showStrategy && (
                    <span className="flex-shrink-0 px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500 text-xs font-medium">
                      {getStrategyMeta(ev.deal.strategyType).navLabel}
                    </span>
                  )}
                </span>
                <span className="text-zinc-500 truncate text-xs mt-0.5">{ev.label}</span>
                <span className={`text-xs font-medium mt-1 ${dayColor}`}>{dayLabel}</span>
              </Link>
            )
          })
        )}
      </div>
    </div>
  )
}
