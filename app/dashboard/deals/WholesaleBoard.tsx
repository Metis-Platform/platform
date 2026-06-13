'use client'

import Link from 'next/link'

export type BoardDeal = {
  id: string
  status: string
  apn: string
  address: string | null
  county: string
  state: string
  dispositionStatus: string | null
  contractPrice: number | null
  assignmentFee: number | null
  closingDeadline: string | null
  buyerName: string | null
  leadSource: string | null
}

type Column = {
  id: string
  label: string
  color: string
  headerColor: string
  filter: (d: BoardDeal) => boolean
}

const COLUMNS: Column[] = [
  {
    id: 'leads',
    label: 'Leads',
    color: 'bg-blue-50 border-blue-200',
    headerColor: 'bg-blue-100 text-blue-700',
    filter: d => d.status === 'LEAD',
  },
  {
    id: 'marketing',
    label: 'Marketing',
    color: 'bg-slate-50 border-slate-200',
    headerColor: 'bg-slate-100 text-slate-700',
    filter: d => d.status === 'ACTIVE' && d.dispositionStatus === 'MARKETING',
  },
  {
    id: 'committed',
    label: 'Buyer Committed',
    color: 'bg-amber-50 border-amber-200',
    headerColor: 'bg-amber-100 text-amber-700',
    filter: d => d.status === 'ACTIVE' && d.dispositionStatus === 'BUYER_COMMITTED',
  },
  {
    id: 'assigned',
    label: 'Assigned',
    color: 'bg-violet-50 border-violet-200',
    headerColor: 'bg-violet-100 text-violet-700',
    filter: d => d.status === 'ACTIVE' && d.dispositionStatus === 'ASSIGNED',
  },
  {
    id: 'closed',
    label: 'Closed',
    color: 'bg-emerald-50 border-emerald-200',
    headerColor: 'bg-emerald-100 text-emerald-700',
    filter: d => d.status === 'SOLD',
  },
]

function DealCard({ deal }: { deal: BoardDeal }) {
  const spread =
    deal.contractPrice != null && deal.assignmentFee != null
      ? deal.contractPrice - deal.assignmentFee
      : null

  const closeDate = deal.closingDeadline ? new Date(deal.closingDeadline) : null
  const now = new Date()
  const isOverdue = closeDate != null && closeDate < now && deal.status !== 'SOLD'

  return (
    <Link
      href={`/dashboard/deals/${deal.id}`}
      className="block bg-white rounded-lg border border-zinc-200 p-3 hover:border-zinc-400 hover:shadow-sm transition-all text-sm"
    >
      <div className="font-mono text-xs text-zinc-500 mb-0.5">{deal.apn}</div>
      {deal.address && (
        <div className="text-xs text-zinc-700 mb-1.5 leading-snug">{deal.address}</div>
      )}
      <div className="text-xs text-zinc-400 mb-2">{deal.county}, {deal.state}</div>

      {deal.contractPrice != null && (
        <div className="flex items-center justify-between text-xs mb-0.5">
          <span className="text-zinc-500">Contract</span>
          <span className="font-medium text-zinc-900">${deal.contractPrice.toLocaleString()}</span>
        </div>
      )}
      {spread != null && (
        <div className="flex items-center justify-between text-xs mb-0.5">
          <span className="text-zinc-500">Spread</span>
          <span className={`font-semibold ${spread >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
            ${spread.toLocaleString()}
          </span>
        </div>
      )}
      {deal.buyerName && (
        <div className="flex items-center justify-between text-xs mb-0.5">
          <span className="text-zinc-500">Buyer</span>
          <span className="text-zinc-700 truncate max-w-28">{deal.buyerName}</span>
        </div>
      )}
      {closeDate && (
        <div className={`text-xs mt-1.5 ${isOverdue ? 'text-red-600 font-medium' : 'text-zinc-400'}`}>
          Close: {closeDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          {isOverdue && ' ⚠'}
        </div>
      )}
      {deal.leadSource && !deal.contractPrice && (
        <div className="text-xs text-zinc-400 mt-1">via {deal.leadSource}</div>
      )}
    </Link>
  )
}

export default function WholesaleBoard({ deals }: { deals: BoardDeal[] }) {
  const deadDeals = deals.filter(d => d.status === 'NOT_WON')

  return (
    <div>
      <div className="grid grid-cols-5 gap-4 min-h-96">
        {COLUMNS.map(col => {
          const colDeals = deals.filter(col.filter)
          return (
            <div key={col.id} className={`rounded-xl border ${col.color} flex flex-col`}>
              <div className={`px-3 py-2 rounded-t-xl flex items-center justify-between ${col.headerColor}`}>
                <span className="text-xs font-semibold">{col.label}</span>
                <span className="text-xs font-medium opacity-70">{colDeals.length}</span>
              </div>
              <div className="flex-1 p-2 space-y-2">
                {colDeals.map(d => <DealCard key={d.id} deal={d} />)}
                {colDeals.length === 0 && (
                  <div className="text-center py-8 text-xs text-zinc-400">—</div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Dead leads — collapsed at bottom */}
      {deadDeals.length > 0 && (
        <div className="mt-6">
          <details>
            <summary className="text-sm font-medium text-zinc-500 cursor-pointer hover:text-zinc-700">
              Dead Leads ({deadDeals.length})
            </summary>
            <div className="mt-3 grid grid-cols-5 gap-3">
              {deadDeals.map(d => <DealCard key={d.id} deal={d} />)}
            </div>
          </details>
        </div>
      )}
    </div>
  )
}
