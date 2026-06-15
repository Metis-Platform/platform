'use client'

import Link from 'next/link'
import { flipPnl, flipRoi, holdDays, annualizedReturn } from '@/lib/economics'

const PERMIT_LABELS: Record<string, string> = {
  NOT_REQUIRED: 'Not required',
  PENDING:      'Pending',
  APPROVED:     'Approved',
  ISSUED:       'Issued',
  FAILED:       'Failed inspection',
  CLOSED:       'Closed out',
}

type ContactSummary = { id: string; firstName: string | null; lastName: string | null; company: string | null }

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
  contractorContact: ContactSummary | null
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

function fmtPct(v: number) {
  return `${(v * 100).toFixed(1)}%`
}

function fmtHold(days: number) {
  if (days < 30) return `${days}d`
  const months = Math.floor(days / 30)
  return months === 1 ? '1 mo' : `${months} mo`
}

function contactLabel(c: ContactSummary) {
  return [c.firstName, c.lastName].filter(Boolean).join(' ') || c.company || 'Contact'
}

export default function FixFlipSection({ data }: { data: FixFlipData }) {
  const {
    dealId, arv, rehabBudget, rehabActualCost, holdingCostEstimate,
    rehabStartDate, rehabTargetCompletion, rehabCompletedDate,
    listingDate, listingPrice, acceptedOfferDate, acceptedOfferPrice, closingDate,
    contractorContact, contractorName, contractorPhone, contractorEmail, permitStatus,
  } = data

  const arvNum        = arv ? Number(arv) : null
  const budgetNum     = rehabBudget ? Number(rehabBudget) : null
  const actualNum     = rehabActualCost ? Number(rehabActualCost) : null
  const holdingNum    = holdingCostEstimate ? Number(holdingCostEstimate) : null
  const purchaseNum   = data.purchasePrice ? Number(data.purchasePrice) : null
  const offerNum      = acceptedOfferPrice ? Number(acceptedOfferPrice) : null

  const budgetVariance = budgetNum != null && actualNum != null ? actualNum - budgetNum : null
  const rehabProgress = budgetNum && actualNum ? Math.min(100, (actualNum / budgetNum) * 100) : null

  const now = new Date()
  const rehabTargetDate = rehabTargetCompletion ? new Date(rehabTargetCompletion) : null
  const isRehabOverdue = rehabTargetDate != null && !rehabCompletedDate && rehabTargetDate < now

  // Economics — realized when offer accepted, projected when only ARV available
  const isRealized = offerNum != null && purchaseNum != null
  const isProjected = !isRealized && arvNum != null && purchaseNum != null

  const rehabForCalc = actualNum ?? budgetNum ?? 0
  const holdingForCalc = holdingNum ?? 0

  const realizedPnlVal = isRealized
    ? flipPnl({ salePrice: offerNum!, purchasePrice: purchaseNum!, rehabCost: rehabForCalc, holdingCosts: holdingForCalc })
    : null
  const projectedPnlVal = isProjected
    ? flipPnl({ salePrice: arvNum!, purchasePrice: purchaseNum!, rehabCost: rehabForCalc, holdingCosts: holdingForCalc })
    : null

  const realizedRoi = realizedPnlVal != null && purchaseNum != null
    ? flipRoi({ pnl: realizedPnlVal, purchasePrice: purchaseNum!, rehabCost: rehabForCalc, holdingCosts: holdingForCalc })
    : null
  const projectedRoi = projectedPnlVal != null && purchaseNum != null
    ? flipRoi({ pnl: projectedPnlVal, purchasePrice: purchaseNum!, rehabCost: rehabForCalc, holdingCosts: holdingForCalc })
    : null

  const purchaseDate = data.purchaseDate ? new Date(data.purchaseDate) : null
  const closeDate    = closingDate ? new Date(closingDate) : null
  const holdDaysVal  = purchaseDate ? holdDays(purchaseDate, closeDate ?? now) : null

  const annualizedRoi = (isRealized ? realizedRoi : projectedRoi) != null && holdDaysVal != null && holdDaysVal > 0
    ? annualizedReturn({
        invested: purchaseNum! + rehabForCalc + holdingForCalc,
        returned: (isRealized ? offerNum : arvNum)!,
        startDate: purchaseDate!,
        endDate: closeDate ?? now,
      })
    : null

  const showEconomics = isRealized || isProjected

  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-zinc-900">Fix & Flip Details</h2>
        <div className="flex items-center gap-3">
          <Link href={`/dashboard/deals/${dealId}/draw-package`} className="text-xs text-zinc-500 hover:text-zinc-900 transition-colors">
            Draw Package
          </Link>
          <Link href={`/dashboard/deals/${dealId}/edit`} className="text-xs text-zinc-500 hover:text-zinc-900 transition-colors">
            Edit
          </Link>
        </div>
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
      </dl>

      {/* Economics panel */}
      {showEconomics && (() => {
        const displayPnl = isRealized ? realizedPnlVal! : projectedPnlVal!
        const displayRoi = isRealized ? realizedRoi : projectedRoi
        return (
          <div className="mt-4 rounded-lg border border-zinc-100 bg-zinc-50 p-4">
            <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">
              {isRealized ? 'Realized Returns' : 'Projected Returns'}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <div className="text-xs text-zinc-500 mb-0.5">{isRealized ? 'P&L' : 'Proj. P&L'}</div>
                <div className={`text-base font-bold ${displayPnl >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                  {fmt$(String(displayPnl))}
                </div>
              </div>
              {displayRoi != null && (
                <div>
                  <div className="text-xs text-zinc-500 mb-0.5">{isRealized ? 'ROI' : 'Proj. ROI'}</div>
                  <div className={`text-base font-bold ${displayRoi >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                    {fmtPct(displayRoi)}
                  </div>
                </div>
              )}
              {annualizedRoi != null && (
                <div>
                  <div className="text-xs text-zinc-500 mb-0.5">Ann. ROI</div>
                  <div className={`text-base font-bold ${annualizedRoi >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                    {fmtPct(annualizedRoi)}
                  </div>
                </div>
              )}
              {holdDaysVal != null && holdDaysVal >= 0 && (
                <div>
                  <div className="text-xs text-zinc-500 mb-0.5">{closeDate ? 'Hold Time' : 'Holding'}</div>
                  <div className="text-base font-bold text-zinc-800">{fmtHold(holdDaysVal)}</div>
                </div>
              )}
            </div>
          </div>
        )
      })()}

      <dl className="space-y-2.5 text-sm mt-4">
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

        {contractorContact ? (
          <Row label="Contractor" value={
            <Link href={`/dashboard/contacts/${contractorContact.id}`} className="text-blue-600 hover:underline">
              {contactLabel(contractorContact)}
            </Link>
          } />
        ) : (
          <>
            {contractorName && <Row label="Contractor" value={contractorName} />}
            {contractorPhone && <Row label="Contractor Phone" value={contractorPhone} />}
            {contractorEmail && <Row label="Contractor Email" value={contractorEmail} />}
          </>
        )}

        {listingDate && <Row label="Target Listing" value={fmtDate(listingDate)} />}
        {listingPrice && <Row label="Listing Price" value={fmt$(listingPrice)} />}
        {acceptedOfferDate && <Row label="Offer Accepted" value={fmtDate(acceptedOfferDate)} />}
        {acceptedOfferPrice && <Row label="Accepted Offer" value={fmt$(acceptedOfferPrice)} />}
        {closingDate && <Row label="Closing Date" value={fmtDate(closingDate)} />}
      </dl>
    </div>
  )
}
