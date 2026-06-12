'use client'

import { useActionState } from 'react'
import { updateLandDisposition, defaultLandNote } from '@/lib/actions/land-disposition'
import type { DispositionFormState } from '@/lib/actions/land-disposition'

const STATUS_LABEL: Record<string, string> = {
  LISTED:         'Listed',
  UNDER_CONTRACT: 'Under Contract',
  SOLD_CASH:      'Sold — Cash',
  SOLD_TERMS:     'Sold — Terms',
  RELISTED:       'Re-listed',
}

const STATUS_COLOR: Record<string, string> = {
  LISTED:         'bg-blue-100 text-blue-700',
  UNDER_CONTRACT: 'bg-amber-100 text-amber-700',
  SOLD_CASH:      'bg-green-100 text-green-700',
  SOLD_TERMS:     'bg-violet-100 text-violet-700',
  RELISTED:       'bg-orange-100 text-orange-700',
}

const initialState: DispositionFormState = {}

function TransitionForm({
  dealId,
  targetStatus,
  label,
  buttonClass,
  withPrice,
}: {
  dealId: string
  targetStatus: string
  label: string
  buttonClass: string
  withPrice?: boolean
}) {
  const boundAction = updateLandDisposition.bind(null, dealId)
  const [state, formAction, pending] = useActionState(boundAction, initialState)

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="targetStatus" value={targetStatus} />
      {withPrice && (
        <div>
          <label className="block text-xs font-medium text-zinc-600 mb-1">Listed Price ($, optional)</label>
          <input type="number" name="listedPrice" min="0.01" step="0.01" placeholder="35000.00"
            className="input-base w-36" />
        </div>
      )}
      {state.message && <p className="w-full text-xs text-red-600">{state.message}</p>}
      <button type="submit" disabled={pending} className={`px-3 py-1.5 text-sm font-medium rounded-lg disabled:opacity-50 transition-colors ${buttonClass}`}>
        {pending ? '…' : label}
      </button>
    </form>
  )
}

export default function LandDispositionSection({
  dealId,
  dispositionStatus,
  listedPrice,
  hasActiveNote,
  noteId,
}: {
  dealId: string
  dispositionStatus: string | null
  listedPrice: number | null
  hasActiveNote: boolean
  noteId: string | null
}) {
  const status = dispositionStatus ?? null

  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-zinc-900">Disposition</h2>
        {status && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[status] ?? 'bg-zinc-100 text-zinc-600'}`}>
            {STATUS_LABEL[status] ?? status}
          </span>
        )}
      </div>

      {/* No disposition yet — active deal on market */}
      {!status && (
        <div className="space-y-2">
          <p className="text-sm text-zinc-400 mb-3">Ready to sell? Start the disposition funnel.</p>
          <TransitionForm
            dealId={dealId}
            targetStatus="LISTED"
            label="List for Sale"
            buttonClass="bg-blue-600 text-white hover:bg-blue-700"
            withPrice
          />
        </div>
      )}

      {status === 'LISTED' && (
        <div className="space-y-3">
          {listedPrice != null && (
            <p className="text-sm text-zinc-600">Listed at <span className="font-medium">${listedPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></p>
          )}
          <TransitionForm
            dealId={dealId}
            targetStatus="UNDER_CONTRACT"
            label="Buyer Under Contract"
            buttonClass="bg-amber-600 text-white hover:bg-amber-700"
          />
        </div>
      )}

      {(status === 'UNDER_CONTRACT' || status === 'RELISTED') && (
        <div className="flex flex-wrap gap-2">
          <TransitionForm
            dealId={dealId}
            targetStatus="SOLD_CASH"
            label="Sold — Cash"
            buttonClass="bg-green-600 text-white hover:bg-green-700"
          />
          <TransitionForm
            dealId={dealId}
            targetStatus="SOLD_TERMS"
            label="Sold — Seller Finance"
            buttonClass="bg-violet-600 text-white hover:bg-violet-700"
          />
        </div>
      )}

      {status === 'SOLD_TERMS' && hasActiveNote && noteId && (
        <DefaultNoteForm dealId={dealId} noteId={noteId} />
      )}

      {(status === 'SOLD_CASH' || (status === 'SOLD_TERMS' && !hasActiveNote)) && (
        <p className="text-sm text-zinc-400">
          {status === 'SOLD_CASH' ? 'Cash sale closed.' : 'Note paid off — deal complete.'}
        </p>
      )}
    </div>
  )
}

function DefaultNoteForm({ dealId, noteId }: { dealId: string; noteId: string }) {
  const boundAction = defaultLandNote.bind(null, dealId, noteId)
  const [state, formAction, pending] = useActionState(boundAction, initialState)

  return (
    <div className="pt-3 border-t border-zinc-100 space-y-2">
      <p className="text-xs text-zinc-500">Buyer has defaulted on the note?</p>
      {state.message && <p className="text-xs text-red-600">{state.message}</p>}
      <form action={formAction}>
        <button type="submit" disabled={pending}
          className="px-3 py-1.5 text-sm font-medium text-red-700 border border-red-300 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors">
          {pending ? '…' : 'Default Note + Re-list'}
        </button>
      </form>
    </div>
  )
}
