import { notFound, redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { syncUserToDatabase } from '@/lib/sync-user'
import { db } from '@/lib/db'
import Link from 'next/link'
import type { ScopeOfWork } from '@/lib/actions/rehab-budget'
import { PrintButton } from './PrintButton'

export default async function DrawPackagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { userId, orgId } = await auth()
  if (!userId || !orgId) redirect('/sign-in')

  const synced = await syncUserToDatabase()
  if (!synced) redirect('/onboarding')
  const { tenant } = synced

  const deal = await db.deal.findUnique({
    where: { id, tenantId: tenant.id },
    include: {
      property: { include: { jurisdiction: true } },
      fixFlip: true,
      transactions: {
        where: { tenantId: tenant.id },
        orderBy: { date: 'asc' },
      },
    },
  })

  if (!deal || deal.strategyType !== 'FIX_FLIP') notFound()

  const { fixFlip, property, transactions } = deal
  const jur = property.jurisdiction
  const scope = fixFlip?.scopeOfWork as ScopeOfWork | null
  const items = scope?.items ?? []

  function fmt$(v: number | null | undefined) {
    if (v == null) return '—'
    return `$${v.toLocaleString('en-US', { minimumFractionDigits: 0 })}`
  }

  const totalBudgeted = items.reduce((s, i) => s + i.budgeted, 0)
  const totalActual   = items.reduce((s, i) => s + (i.actual ?? 0), 0)
  const completeCount = items.filter(i => i.status === 'COMPLETE').length
  const pctComplete   = items.length > 0 ? Math.round((completeCount / items.length) * 100) : 0

  const totalTxAmount = transactions.reduce((s, t) => s + Number(t.amount), 0)

  const statusLabel: Record<string, string> = {
    PENDING:     'Pending',
    IN_PROGRESS: 'In Progress',
    COMPLETE:    'Complete',
  }

  return (
    <div className="max-w-4xl mx-auto p-8 print:p-0">
      {/* Print button — hidden in print */}
      <div className="mb-6 print:hidden flex items-center gap-3">
        <PrintButton />
        <Link href={`/dashboard/deals/${id}`} className="text-sm text-zinc-500 hover:text-zinc-900 underline">
          ← Back to deal
        </Link>
      </div>

      {/* Header */}
      <div className="mb-6 border-b border-zinc-200 pb-4">
        <div className="text-xs text-zinc-500 uppercase tracking-wide mb-1">
          Lender Draw Package — Fix & Flip — {jur.county} County, {jur.state}
        </div>
        <h1 className="text-2xl font-bold text-zinc-900 font-mono">{property.apn}</h1>
        {property.address && <p className="text-sm text-zinc-600 mt-0.5">{property.address}</p>}
        <div className="text-xs text-zinc-400 mt-1">
          Generated {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {/* Project summary */}
      <section className="mb-6">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-3">Project Summary</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border border-zinc-100 rounded-lg p-4 bg-zinc-50">
          <Metric label="Purchase Price" value={fmt$(deal.purchasePrice ? Number(deal.purchasePrice) : null)} />
          <Metric label="Rehab Budget" value={fmt$(fixFlip?.rehabBudget ? Number(fixFlip.rehabBudget) : null)} />
          <Metric label="Rehab Actual" value={fmt$(fixFlip?.rehabActualCost ? Number(fixFlip.rehabActualCost) : null)} />
          <Metric label="ARV" value={fmt$(fixFlip?.arv ? Number(fixFlip.arv) : null)} />
          <Metric label="SOW Progress" value={items.length > 0 ? `${pctComplete}% (${completeCount}/${items.length})` : '—'} />
          <Metric
            label="Rehab Start"
            value={fixFlip?.rehabStartDate ? new Date(fixFlip.rehabStartDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
          />
          <Metric
            label="Target Completion"
            value={fixFlip?.rehabTargetCompletion ? new Date(fixFlip.rehabTargetCompletion).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
          />
          <Metric label="Permit Status" value={fixFlip?.permitStatus ?? '—'} />
        </div>
      </section>

      {/* Scope of Work */}
      <section className="mb-6">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-3">Scope of Work</h2>
        {items.length === 0 ? (
          <p className="text-sm text-zinc-400">No scope of work items.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-zinc-100 rounded-lg">
                <thead>
                  <tr className="bg-zinc-50 text-left text-zinc-400">
                    <th className="px-3 py-2 font-medium">Category</th>
                    <th className="px-3 py-2 font-medium">Description</th>
                    <th className="px-3 py-2 font-medium text-right">Budgeted</th>
                    <th className="px-3 py-2 font-medium text-right">Actual</th>
                    <th className="px-3 py-2 font-medium text-right">Variance</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => {
                    const variance = item.actual != null ? item.actual - item.budgeted : null
                    return (
                      <tr key={item.id} className="border-t border-zinc-100">
                        <td className="px-3 py-1.5 text-zinc-500 whitespace-nowrap">{item.category}</td>
                        <td className="px-3 py-1.5 text-zinc-700">{item.description}</td>
                        <td className="px-3 py-1.5 text-right font-medium">{fmt$(item.budgeted)}</td>
                        <td className="px-3 py-1.5 text-right">{item.actual != null ? fmt$(item.actual) : '—'}</td>
                        <td className={`px-3 py-1.5 text-right ${variance != null && variance > 0 ? 'text-red-600' : variance != null && variance < 0 ? 'text-emerald-600' : ''}`}>
                          {variance != null ? (variance >= 0 ? '+' : '') + fmt$(variance) : '—'}
                        </td>
                        <td className="px-3 py-1.5">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                            item.status === 'COMPLETE'    ? 'bg-emerald-100 text-emerald-700' :
                            item.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                                                            'bg-zinc-100 text-zinc-600'
                          }`}>
                            {statusLabel[item.status] ?? item.status}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-zinc-300 bg-zinc-50 font-semibold">
                    <td className="px-3 py-2" colSpan={2}>Total</td>
                    <td className="px-3 py-2 text-right">{fmt$(totalBudgeted)}</td>
                    <td className="px-3 py-2 text-right">{totalActual > 0 ? fmt$(totalActual) : '—'}</td>
                    <td className={`px-3 py-2 text-right ${totalActual > totalBudgeted ? 'text-red-600' : totalActual > 0 ? 'text-emerald-600' : ''}`}>
                      {totalActual > 0 ? (totalActual >= totalBudgeted ? '+' : '') + fmt$(totalActual - totalBudgeted) : '—'}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="mt-2 flex gap-4 text-xs text-zinc-500">
              <span>Complete: <strong>{completeCount}</strong></span>
              <span>In Progress: <strong>{items.filter(i => i.status === 'IN_PROGRESS').length}</strong></span>
              <span>Pending: <strong>{items.filter(i => i.status === 'PENDING').length}</strong></span>
            </div>
          </>
        )}
      </section>

      {/* Transaction ledger */}
      {transactions.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-3">Transaction Ledger</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border border-zinc-100 rounded-lg">
              <thead>
                <tr className="bg-zinc-50 text-left text-zinc-400">
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Description</th>
                  <th className="px-3 py-2 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(t => (
                  <tr key={t.id} className="border-t border-zinc-100">
                    <td className="px-3 py-1.5 text-zinc-500 whitespace-nowrap">
                      {new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-3 py-1.5 text-zinc-500 whitespace-nowrap">{t.type.replace(/_/g, ' ')}</td>
                    <td className="px-3 py-1.5 text-zinc-700">{t.description ?? '—'}</td>
                    <td className={`px-3 py-1.5 text-right font-medium ${Number(t.amount) < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                      {Number(t.amount) >= 0 ? '+' : ''}{fmt$(Number(t.amount))}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-zinc-300 bg-zinc-50 font-semibold">
                  <td className="px-3 py-2" colSpan={3}>Net</td>
                  <td className={`px-3 py-2 text-right ${totalTxAmount < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                    {totalTxAmount >= 0 ? '+' : ''}{fmt$(totalTxAmount)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}

      <div className="text-xs text-zinc-300 text-center mt-8 print:block hidden">
        Generated by Metis Platform · metisplatforms.com
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-zinc-400 mb-0.5">{label}</div>
      <div className="text-sm font-semibold text-zinc-800">{value}</div>
    </div>
  )
}
