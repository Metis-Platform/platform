import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { syncUserToDatabase } from '@/lib/sync-user'
import { db } from '@/lib/db'
import { EventStatus, StrategyType } from '@/app/generated/prisma'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EventRow = {
  id: string
  dealId: string
  label: string
  dueDate: Date
  deal: { property: { apn: string; address: string | null } }
}

const STRATEGY_LABELS: Record<string, string> = {
  TAX_LIEN:    'Tax Lien',
  TAX_DEED:    'Tax Deed',
  FORECLOSURE: 'Foreclosure',
}

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
  const strategy = strategyParam === 'TAX_DEED' ? StrategyType.TAX_DEED
    : strategyParam === 'FORECLOSURE' ? StrategyType.FORECLOSURE
    : StrategyType.TAX_LIEN
  const strategyLabel = STRATEGY_LABELS[strategy] ?? 'Tax Lien'

  const now = new Date()
  const in7d  = new Date(now.getTime() + 7  * 86_400_000)
  const in30d = new Date(now.getTime() + 30 * 86_400_000)

  const include = { deal: { include: { property: true } } } as const

  const [activeCount, overdueEvents, urgentEvents, upcomingEvents] = await Promise.all([
    db.deal.count({ where: { tenantId, strategyType: strategy, status: 'ACTIVE' } }),
    db.event.findMany({ where: { status: EventStatus.OVERDUE,  deal: { tenantId, strategyType: strategy } }, include, orderBy: { dueDate: 'asc' }, take: 15 }),
    db.event.findMany({ where: { status: EventStatus.PENDING,  dueDate: { lte: in7d  }, deal: { tenantId, strategyType: strategy } }, include, orderBy: { dueDate: 'asc' }, take: 15 }),
    db.event.findMany({ where: { status: EventStatus.PENDING,  dueDate: { gt: in7d, lte: in30d }, deal: { tenantId, strategyType: strategy } }, include, orderBy: { dueDate: 'asc' }, take: 15 }),
  ])

  // Portfolio value — lien face amount, deed/foreclosure winning bid
  const totalValue = strategy === StrategyType.TAX_LIEN
    ? Number((await db.dealTaxLien.aggregate({ where: { deal: { tenantId } }, _sum: { faceAmount: true } }))._sum.faceAmount ?? 0)
    : strategy === StrategyType.TAX_DEED
      ? Number((await db.dealTaxDeed.aggregate({ where: { deal: { tenantId } }, _sum: { winningBid: true } }))._sum.winningBid ?? 0)
      : Number((await db.dealForeclosure.aggregate({ where: { deal: { tenantId } }, _sum: { winningBid: true } }))._sum.winningBid ?? 0)

  const newDealHref = `/dashboard/liens/new?strategy=${strategy}`

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900">Dashboard</h1>
        <Link
          href={newDealHref}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <span>+</span> New {strategyLabel}
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label={`Active ${strategyLabel}s`} value={activeCount} />
        <StatCard label="Portfolio Value"             value={`$${totalValue.toLocaleString()}`} />
        <StatCard label="Overdue"                     value={overdueEvents.length}  accent={overdueEvents.length > 0 ? 'red' : undefined} />
        <StatCard label="Due in 7 Days"               value={urgentEvents.length}   accent={urgentEvents.length  > 0 ? 'yellow' : undefined} />
      </div>

      {/* Deadline buckets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Bucket title="Overdue"        events={overdueEvents  as EventRow[]} color="red" />
        <Bucket title="Due in 7 Days"  events={urgentEvents   as EventRow[]} color="yellow" />
        <Bucket title="Due in 30 Days" events={upcomingEvents as EventRow[]} color="blue" />
      </div>

      {/* Empty state */}
      {activeCount === 0 && (
        <div className="mt-12 text-center py-16 bg-white rounded-xl border border-zinc-200">
          <p className="text-zinc-500 mb-4">No {strategyLabel.toLowerCase()}s yet. Add your first to see deadlines here.</p>
          <Link
            href={newDealHref}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            + Add First {strategyLabel}
          </Link>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: 'red' | 'yellow' }) {
  const bg   = accent === 'red' ? 'bg-red-50 border-red-200' : accent === 'yellow' ? 'bg-yellow-50 border-yellow-200' : 'bg-white border-zinc-200'
  const text = accent === 'red' ? 'text-red-700'             : accent === 'yellow' ? 'text-yellow-700'                 : 'text-zinc-900'
  return (
    <div className={`rounded-xl border p-4 ${bg}`}>
      <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${text}`}>{value}</p>
    </div>
  )
}

function Bucket({ title, events, color }: { title: string; events: EventRow[]; color: 'red' | 'yellow' | 'blue' }) {
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
            const days = Math.round((ev.dueDate.getTime() - Date.now()) / 86_400_000)
            const dayLabel = days < 0 ? `${Math.abs(days)}d overdue` : `${days}d remaining`
            const dayColor = days < 0 ? 'text-red-600' : days <= 7 ? 'text-yellow-600' : 'text-blue-600'
            return (
              <Link key={ev.id} href={`/dashboard/liens/${ev.dealId}`} className="flex flex-col px-4 py-3 hover:bg-zinc-50 text-sm transition-colors">
                <span className="font-medium text-zinc-900 truncate">{ev.deal.property.apn}</span>
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
