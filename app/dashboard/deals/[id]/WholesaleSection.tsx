'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { updateWholesaleDisposition } from '@/lib/actions/wholesale'
import type { WholesaleFormState } from '@/lib/actions/wholesale'

const DISPOSITION_LABEL: Record<string, string> = {
  MARKETING:       'Marketing to Buyers',
  BUYER_COMMITTED: 'Buyer Committed',
  ASSIGNED:        'Contract Assigned',
  CLOSED:          'Closed',
}

const DISPOSITION_COLOR: Record<string, string> = {
  MARKETING:       'bg-blue-100 text-blue-700',
  BUYER_COMMITTED: 'bg-amber-100 text-amber-700',
  ASSIGNED:        'bg-violet-100 text-violet-700',
  CLOSED:          'bg-green-100 text-green-700',
}

const initialState: WholesaleFormState = {}

function DispatchButton({
  dealId,
  targetDealStatus,
  targetDisposition,
  label,
  buttonClass,
}: {
  dealId: string
  targetDealStatus: string
  targetDisposition: string
  label: string
  buttonClass: string
}) {
  const bound = updateWholesaleDisposition.bind(null, dealId, targetDealStatus, targetDisposition)
  const [state, formAction, pending] = useActionState(bound, initialState)

  return (
    <form action={formAction} className="inline">
      {state.message && <p className="text-xs text-red-600 mb-1">{state.message}</p>}
      <button type="submit" disabled={pending}
        className={`px-3 py-1.5 text-sm font-medium rounded-lg disabled:opacity-50 transition-colors ${buttonClass}`}>
        {pending ? '…' : label}
      </button>
    </form>
  )
}

export type WholesaleData = {
  dealId: string
  dealStatus: string
  leadSource: string | null
  contractDate: string | null
  contractPrice: string | null
  earnestMoney: string | null
  inspectionDeadline: string | null
  closingDeadline: string | null
  assignmentFee: string | null
  buyerName: string | null
  buyerEmail: string | null
  buyerPhone: string | null
  dispositionStatus: string | null
  marketingNotes: string | null
}

export default function WholesaleSection({ data }: { data: WholesaleData }) {
  const {
    dealId, dealStatus, leadSource, contractDate, contractPrice, earnestMoney,
    inspectionDeadline, closingDeadline, assignmentFee, buyerName, buyerEmail,
    buyerPhone, dispositionStatus, marketingNotes,
  } = data

  const isLead  = dealStatus === 'LEAD'
  const isActive = dealStatus === 'ACTIVE'
  const isSold   = dealStatus === 'SOLD'
  const isNotWon = dealStatus === 'NOT_WON'

  const spread =
    contractPrice != null && assignmentFee != null
      ? Number(contractPrice) - Number(assignmentFee)
      : null

  const inspDate = inspectionDeadline ? new Date(inspectionDeadline) : null
  const closeDate = closingDeadline ? new Date(closingDeadline) : null
  const now = new Date()

  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-zinc-900">
          {isLead ? 'Lead Info' : isSold ? 'Assignment Details' : 'Contract Details'}
        </h2>
        <div className="flex items-center gap-2">
          {dispositionStatus && (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${DISPOSITION_COLOR[dispositionStatus] ?? 'bg-zinc-100 text-zinc-600'}`}>
              {DISPOSITION_LABEL[dispositionStatus] ?? dispositionStatus}
            </span>
          )}
          <Link href={`/dashboard/deals/${dealId}/edit`} className="text-xs text-zinc-500 hover:text-zinc-900 transition-colors">
            Edit
          </Link>
        </div>
      </div>

      <dl className="space-y-2.5 text-sm">
        {leadSource && <Row label="Lead Source" value={leadSource} />}
        {contractDate && (
          <Row label="Contract Date" value={new Date(contractDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })} />
        )}
        {contractPrice && (
          <Row label="Contract Price" value={`$${Number(contractPrice).toLocaleString('en-US', { minimumFractionDigits: 2 })}`} />
        )}
        {earnestMoney && (
          <Row label="Earnest Money" value={`$${Number(earnestMoney).toLocaleString('en-US', { minimumFractionDigits: 2 })}`} />
        )}
        {inspDate && (
          <Row
            label="Inspection End"
            value={
              <span className={inspDate < now ? 'text-red-600 font-medium' : ''}>
                {inspDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
              </span>
            }
          />
        )}
        {closeDate && (
          <Row
            label="Closing Deadline"
            value={
              <span className={closeDate < now ? 'text-red-600 font-medium' : ''}>
                {closeDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
              </span>
            }
          />
        )}
        {assignmentFee != null && (
          <Row label="Assignment Fee" value={`$${Number(assignmentFee).toLocaleString('en-US', { minimumFractionDigits: 2 })}`} />
        )}
        {spread != null && (
          <Row
            label="Spread"
            value={
              <span className={spread >= 0 ? 'text-green-700 font-semibold' : 'text-red-600 font-semibold'}>
                ${spread.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            }
          />
        )}
        {buyerName && <Row label="Buyer" value={buyerName} />}
        {buyerPhone && <Row label="Buyer Phone" value={buyerPhone} />}
        {buyerEmail && <Row label="Buyer Email" value={buyerEmail} />}
        {marketingNotes && <Row label="Marketing Notes" value={marketingNotes} />}
      </dl>

      {/* Pipeline actions */}
      <div className="mt-4 pt-4 border-t border-zinc-100 flex flex-wrap gap-2">
        {isLead && (
          <>
            <DispatchButton dealId={dealId} targetDealStatus="ACTIVE" targetDisposition="MARKETING"
              label="Under Contract" buttonClass="bg-blue-600 text-white hover:bg-blue-700" />
            <DispatchButton dealId={dealId} targetDealStatus="NOT_WON" targetDisposition=""
              label="Dead Lead" buttonClass="border border-zinc-300 text-zinc-600 hover:bg-zinc-50" />
          </>
        )}
        {isActive && !dispositionStatus && (
          <DispatchButton dealId={dealId} targetDealStatus="ACTIVE" targetDisposition="MARKETING"
            label="Start Marketing" buttonClass="bg-blue-600 text-white hover:bg-blue-700" />
        )}
        {isActive && dispositionStatus === 'MARKETING' && (
          <DispatchButton dealId={dealId} targetDealStatus="ACTIVE" targetDisposition="BUYER_COMMITTED"
            label="Buyer Committed" buttonClass="bg-amber-600 text-white hover:bg-amber-700" />
        )}
        {isActive && dispositionStatus === 'BUYER_COMMITTED' && (
          <DispatchButton dealId={dealId} targetDealStatus="ACTIVE" targetDisposition="ASSIGNED"
            label="Contract Assigned" buttonClass="bg-violet-600 text-white hover:bg-violet-700" />
        )}
        {isActive && dispositionStatus === 'ASSIGNED' && (
          <DispatchButton dealId={dealId} targetDealStatus="SOLD" targetDisposition="CLOSED"
            label="Mark Closed" buttonClass="bg-green-600 text-white hover:bg-green-700" />
        )}
        {isNotWon && (
          <DispatchButton dealId={dealId} targetDealStatus="LEAD" targetDisposition=""
            label="Re-activate Lead" buttonClass="border border-zinc-300 text-zinc-600 hover:bg-zinc-50" />
        )}
        {isSold && (
          <span className="text-sm text-zinc-400">Assignment closed.</span>
        )}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="w-32 shrink-0 text-zinc-500">{label}</dt>
      <dd className="text-zinc-900">{value}</dd>
    </div>
  )
}
