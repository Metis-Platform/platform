'use client'

import Link from 'next/link'

const PERMIT_LABELS: Record<string, string> = {
  NOT_REQUIRED: 'Not required',
  PENDING:      'Pending',
  APPROVED:     'Approved',
  ISSUED:       'Issued',
  FAILED:       'Failed inspection',
  CLOSED:       'Closed out',
}

export type FixFlipData = {
  dealId: string
  dealStatus: string
  purchasePrice: string | null
  purchaseDate: string | null
  arv: string | null
  rehabBudget: string | null
  rehabActualCost: string | null
  holdingCostEstimate: string | null
  rehabStartDate: string | null
  rehabTargetCompletion: string | null
  rehabCompletedDate: string | null
  listingDate: string | null
  listingPrice: string | null
  acceptedOfferDate: string | null
  acceptedOfferPrice: string | null
  closingDate: string | null
  contractorName: string | null
  contractorPhone: string | null
  contractorEmail: string | null
  permitStatus: string | null
  notes: string | null
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="w-40 shrink-0 text-zinc-500">{label}</dt>
      <dd className="text-zinc-900">{value}</dd>
    </div>
  )
}

function fmt$(v: string | null) {
  if (!v) return null
  return `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function fmtDate(v: string | null) {
  if (!v) return null
  return new Date(v).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function FixFlipSection({ data }: { data: FixFlipData }) {
  const {
    dealId, arv, rehabBudget, rehabActualCost, holdingCostEstimate,
    rehabStartDate, rehabTargetCompletion, rehabCompletedDate,
    listingDate, listingPrice, acceptedOfferDate, acceptedOfferPrice, closingDate,
    contractorName, contractorPhone, contractorEmail, permitStatus,
  } = data

  const arvNum        = arv ? Number(arv) : null
  const budgetNum     = rehabBudget ? Number(rehabBudget) : null
  const actualNum     = rehabActualCost ? Number(rehabActualCost) : null
  const holdingNum    = holdingCostEstimate ? Number(holdingCostEstimate) : null
  const purchaseNum   = data.purchasePrice ? Number(data.purchasePrice) : null

  const budgetVariance = budgetNum != null && actualNum != null ? actualNum - budgetNum : null
  const rehabProgress = budgetNum && actualNum ? Math.min(100, (actualNum / budgetNum) * 100) : null

  // Gross profit = ARV - purchase - actual rehab - holding costs
  const grossProfit =
    arvNum != null && purchaseNum != null
      ? arvNum - purchaseNum - (actualNum ?? budgetNum ?? 0) - (holdingNum ?? 0)
      : null

  const now = new Date()
  const rehabTargetDate = rehabTargetCompletion ? new Date(rehabTargetCompletion) : null
  const isRehabOverdue = rehabTargetDate != null && !rehabCompletedDate && rehabTargetDate < now

  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-zinc-900">Fix & Flip Details</h2>
        <Link href={`/dashboard/deals/${dealId}/edit`} className="text-xs text-zinc-500 hover:text-zinc-900 transition-colors">
          Edit
        </Link>
      </div>

      <dl className="space-y-2.5 text-sm">
        {arvNum != null && <Row label="After Repair Value" value={
          <span className="font-semibold text-emerald-700">{fmt$(arv)}</span>
        } />}

        {rehabBudget && <Row label="Rehab Budget" value={fmt$(rehabBudget)} />}

        {rehabActualCost && (
          <Row label="Actual Rehab Cost" value={
            <span className={budgetVariance != null && budgetVariance > 0 ? 'text-red-600 font-semibold' : ''}>
              {fmt$(rehabActualCost)}
              {budgetVariance != null && (
                <span className="ml-2 text-xs">
                  ({budgetVariance >= 0 ? '+' : ''}{fmt$(String(budgetVariance))} vs budget)
                </span>
              )}
            </span>
          } />
        )}

        {rehabProgress != null && (
          <Row label="Budget Used" value={
            <div className="flex items-center gap-2">
              <div className="w-24 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${rehabProgress > 100 ? 'bg-red-500' : 'bg-blue-500'}`}
                  style={{ width: `${Math.min(rehabProgress, 100)}%` }}
                />
              </div>
              <span className={`text-xs ${rehabProgress > 100 ? 'text-red-600 font-medium' : 'text-zinc-500'}`}>
                {rehabProgress.toFixed(0)}%
              </span>
            </div>
          } />
        )}

        {holdingCostEstimate && <Row label="Est. Holding Costs" value={fmt$(holdingCostEstimate)} />}

        {grossProfit != null && (
          <Row label="Est. Gross Profit" value={
            <span className={`font-semibold ${grossProfit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
              {fmt$(String(grossProfit))}
            </span>
          } />
        )}

        {rehabStartDate && <Row label="Rehab Start" value={fmtDate(rehabStartDate)} />}

        {rehabTargetCompletion && (
          <Row label="Target Completion" value={
            <span className={isRehabOverdue ? 'text-red-600 font-medium' : ''}>
              {fmtDate(rehabTargetCompletion)}{isRehabOverdue ? ' ⚠ overdue' : ''}
            </span>
          } />
        )}

        {rehabCompletedDate && <Row label="Rehab Completed" value={fmtDate(rehabCompletedDate)} />}

        {permitStatus && (
          <Row label="Permit Status" value={
            <span className={
              permitStatus === 'ISSUED' || permitStatus === 'CLOSED' ? 'text-emerald-700'
              : permitStatus === 'FAILED' ? 'text-red-600'
              : 'text-zinc-700'
            }>
              {PERMIT_LABELS[permitStatus] ?? permitStatus}
            </span>
          } />
        )}

        {contractorName && <Row label="Contractor" value={contractorName} />}
        {contractorPhone && <Row label="Contractor Phone" value={contractorPhone} />}
        {contractorEmail && <Row label="Contractor Email" value={contractorEmail} />}

        {listingDate && <Row label="Target Listing" value={fmtDate(listingDate)} />}
        {listingPrice && <Row label="Listing Price" value={fmt$(listingPrice)} />}
        {acceptedOfferDate && <Row label="Offer Accepted" value={fmtDate(acceptedOfferDate)} />}
        {acceptedOfferPrice && <Row label="Accepted Offer" value={fmt$(acceptedOfferPrice)} />}
        {closingDate && <Row label="Closing Date" value={fmtDate(closingDate)} />}
      </dl>
    </div>
  )
}
