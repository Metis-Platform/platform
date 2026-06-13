import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/db'
import { hasTier } from '@/lib/entitlements'
import { notePortfolioMetrics } from '@/lib/land-note-servicing'

export const metadata = { title: 'Note Portfolio — Metis' }

export default async function NotesPortfolioPage() {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) redirect('/sign-in')

  const tenant = await db.tenant.findUnique({ where: { clerkOrgId: orgId } })
  if (!tenant) redirect('/sign-in')

  const hasPremium = await hasTier(tenant.id, 'LAND', 'PREMIUM')

  const rawNotes = await db.landNote.findMany({
    where: { tenantId: tenant.id },
    include: {
      deal: {
        select: {
          id: true,
          property: { select: { apn: true, address: true, city: true, state: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const rawPayments = await db.financialTransaction.findMany({
    where: { tenantId: tenant.id, type: 'NOTE_PAYMENT_RECEIVED' },
    select: { amount: true },
  })

  const notes = rawNotes.map(n => ({
    id: n.id,
    dealId: n.deal.id,
    apn: n.deal.property.apn,
    address: [n.deal.property.address, n.deal.property.city, n.deal.property.state].filter(Boolean).join(', '),
    buyerName: n.buyerName,
    principal: Number(n.principal),
    interestRate: Number(n.interestRate),
    termMonths: n.termMonths,
    paymentAmount: Number(n.paymentAmount),
    firstPaymentDate: n.firstPaymentDate,
    balance: Number(n.balance),
    status: n.status as string,
    createdAt: n.createdAt,
  }))

  const payments = rawPayments.map(p => ({ amount: Number(p.amount) }))
  const metrics = notePortfolioMetrics(notes, payments)

  const statusColors: Record<string, string> = {
    ACTIVE:    'bg-emerald-100 text-emerald-800',
    PAID_OFF:  'bg-blue-100 text-blue-800',
    DEFAULTED: 'bg-red-100 text-red-700',
    DELINQUENT:'bg-amber-100 text-amber-700',
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Note Portfolio</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Seller-finance notes across all Land deals</p>
        </div>
        {!hasPremium && (
          <div className="text-xs text-zinc-400 bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2">
            Upgrade to Land PREMIUM for payoff quotes and automated notices
          </div>
        )}
      </div>

      {/* Metrics */}
      {notes.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <MetricCard label="Total notes" value={String(metrics.totalNotes)} />
          <MetricCard label="Active" value={String(metrics.activeNotes)} />
          <MetricCard
            label="Outstanding balance"
            value={`$${metrics.totalOutstandingBalance.toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
          />
          <MetricCard
            label="Avg yield"
            value={metrics.averageYieldPct != null ? `${metrics.averageYieldPct.toFixed(1)}%` : '—'}
          />
          <MetricCard
            label="Collected (all time)"
            value={`$${metrics.totalCollected.toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
          />
          <MetricCard label="Delinquent" value={String(metrics.delinquentCount)}
            className={metrics.delinquentCount > 0 ? 'border-red-200 bg-red-50' : ''} />
          <MetricCard
            label="Delinquency rate"
            value={`${metrics.delinquencyRatePct.toFixed(1)}%`}
            className={metrics.delinquencyRatePct > 0 ? 'border-amber-200 bg-amber-50' : ''} />
          <MetricCard
            label="Principal originated"
            value={`$${metrics.totalPrincipalOriginated.toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
          />
        </div>
      )}

      {/* Note list */}
      {notes.length === 0 ? (
        <div className="text-center py-16 text-zinc-400 text-sm">
          No seller-finance notes yet. Add notes from individual Land deal pages.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Deal / Property</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Buyer</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-zinc-500">Principal</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-zinc-500">Balance</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-zinc-500">Rate</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-zinc-500">Payment/mo</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {notes.map(n => (
                <tr key={n.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/deals/${n.dealId}`}
                      className="font-medium text-zinc-900 hover:text-violet-600 transition-colors block">
                      {n.apn}
                    </Link>
                    <span className="text-xs text-zinc-400">{n.address}</span>
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{n.buyerName ?? <span className="text-zinc-300">—</span>}</td>
                  <td className="px-4 py-3 text-right text-zinc-700">
                    ${n.principal.toLocaleString('en-US', { minimumFractionDigits: 0 })}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-zinc-800">
                    {n.status === 'PAID_OFF'
                      ? <span className="text-emerald-600 text-xs font-semibold">Paid off</span>
                      : `$${n.balance.toLocaleString('en-US', { minimumFractionDigits: 0 })}`}
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-600">
                    {(n.interestRate * 100).toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-600">
                    ${n.paymentAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[n.status] ?? 'bg-zinc-100 text-zinc-500'}`}>
                      {n.status.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
