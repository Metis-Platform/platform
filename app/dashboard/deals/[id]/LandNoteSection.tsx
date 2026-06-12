'use client'

import { useState, useActionState } from 'react'
import { createLandNote, recordPayment } from '@/lib/actions/land-note'
import type { LandNoteFormState } from '@/lib/actions/land-note'

export type NoteData = {
  id: string
  buyerName: string | null
  buyerEmail: string | null
  buyerPhone: string | null
  principal: string
  interestRate: string // fraction, e.g. '0.0800'
  termMonths: number
  paymentAmount: string
  firstPaymentDate: string // ISO string
  balance: string
  status: string
  notes: string | null
  createdAt: string
}

export type NotePayment = {
  id: string
  amount: string
  date: string
  description: string | null
}

const initialState: LandNoteFormState = {}

function CreateNoteForm({ dealId, onClose }: { dealId: string; onClose: () => void }) {
  const boundAction = createLandNote.bind(null, dealId)
  const [state, formAction, pending] = useActionState(boundAction, initialState)

  if (!state.message && !state.errors && !pending && Object.keys(state).length === 0 && state !== initialState) {
    onClose()
  }

  return (
    <form action={formAction} className="space-y-4 pt-4 border-t border-zinc-100">
      {state.message && (
        <p className="text-sm text-red-600">{state.message}</p>
      )}

      {/* Buyer info */}
      <div>
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">Buyer</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Buyer Name" error={state.errors?.buyerName}>
            <input type="text" name="buyerName" placeholder="John Smith" className="input-base" />
          </Field>
          <Field label="Email" error={state.errors?.buyerEmail}>
            <input type="email" name="buyerEmail" placeholder="john@example.com" className="input-base" />
          </Field>
          <Field label="Phone" error={state.errors?.buyerPhone}>
            <input type="tel" name="buyerPhone" placeholder="555-1234" className="input-base" />
          </Field>
        </div>
      </div>

      {/* Note terms */}
      <div>
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">Note Terms</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Principal ($)" error={state.errors?.principal}>
            <input type="number" name="principal" min="0.01" step="0.01" placeholder="25000.00" className="input-base" />
          </Field>
          <Field label="Interest Rate (%)" error={state.errors?.interestRate}>
            <input type="number" name="interestRate" min="0" max="100" step="0.01" placeholder="10.00" className="input-base" />
          </Field>
          <Field label="Term (months)" error={state.errors?.termMonths}>
            <input type="number" name="termMonths" min="1" step="1" placeholder="60" className="input-base" />
          </Field>
          <Field label="Monthly Payment ($)" error={state.errors?.paymentAmount}>
            <input type="number" name="paymentAmount" min="0.01" step="0.01" placeholder="530.00" className="input-base" />
          </Field>
        </div>
      </div>

      {/* First payment date */}
      <div className="max-w-xs">
        <Field label="First Payment Date" error={state.errors?.firstPaymentDate}>
          <input type="date" name="firstPaymentDate" className="input-base" />
        </Field>
      </div>

      {/* Notes */}
      <Field label="Notes (optional)" error={state.errors?.notes}>
        <textarea name="notes" rows={2} placeholder="Terms, balloon, prepayment…" className="input-base resize-none" />
      </Field>

      <div className="flex gap-3">
        <button type="submit" disabled={pending}
          className="px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors">
          {pending ? 'Saving…' : 'Create Note'}
        </button>
        <button type="button" onClick={onClose}
          className="px-4 py-2 text-sm text-zinc-500 hover:text-zinc-700 transition-colors">
          Cancel
        </button>
      </div>
    </form>
  )
}

function RecordPaymentForm({ dealId, noteId, onClose }: { dealId: string; noteId: string; onClose: () => void }) {
  const boundAction = recordPayment.bind(null, dealId)
  const [state, formAction, pending] = useActionState(boundAction, initialState)
  const today = new Date().toISOString().slice(0, 10)

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 pt-3 border-t border-zinc-100">
      <input type="hidden" name="noteId" value={noteId} />
      {state.message && (
        <p className="w-full text-sm text-red-600">{state.message}</p>
      )}
      <Field label="Amount ($)" error={state.errors?.amount}>
        <input type="number" name="amount" min="0.01" step="0.01" placeholder="530.00"
          className="input-base w-36" />
      </Field>
      <Field label="Date" error={state.errors?.date}>
        <input type="date" name="date" defaultValue={today} className="input-base w-40" />
      </Field>
      <div className="flex gap-2 pb-0.5">
        <button type="submit" disabled={pending}
          className="px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors">
          {pending ? 'Saving…' : 'Record'}
        </button>
        <button type="button" onClick={onClose}
          className="px-3 py-2 text-sm text-zinc-500 hover:text-zinc-700 transition-colors">
          Cancel
        </button>
      </div>
    </form>
  )
}

export default function LandNoteSection({
  dealId,
  notes,
  payments,
}: {
  dealId: string
  notes: NoteData[]
  payments: NotePayment[]
}) {
  const [showCreate, setShowCreate] = useState(false)
  const [showPayment, setShowPayment] = useState(false)

  const activeNote = notes.find(n => n.status === 'ACTIVE') ?? notes[0] ?? null
  const hasNotes = notes.length > 0

  const totalCollected = payments.reduce((sum, p) => sum + Number(p.amount), 0)

  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-zinc-900">Seller Finance Note</h2>
        {!hasNotes && !showCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="text-xs text-violet-600 hover:text-violet-800 font-medium transition-colors"
          >
            + Add Note
          </button>
        )}
        {activeNote && !showPayment && (
          <button
            onClick={() => setShowPayment(true)}
            className="text-xs text-violet-600 hover:text-violet-800 font-medium transition-colors"
          >
            Record Payment
          </button>
        )}
      </div>

      {!hasNotes && !showCreate && (
        <p className="text-sm text-zinc-400">No seller-finance note yet.</p>
      )}

      {showCreate && (
        <CreateNoteForm dealId={dealId} onClose={() => setShowCreate(false)} />
      )}

      {activeNote && (
        <>
          <dl className="space-y-2 text-sm">
            {activeNote.buyerName && <NoteRow label="Buyer" value={activeNote.buyerName} />}
            {activeNote.buyerPhone && <NoteRow label="Phone" value={activeNote.buyerPhone} />}
            {activeNote.buyerEmail && <NoteRow label="Email" value={activeNote.buyerEmail} />}
            <NoteRow label="Principal" value={`$${Number(activeNote.principal).toLocaleString('en-US', { minimumFractionDigits: 2 })}`} />
            <NoteRow label="Rate" value={`${(Number(activeNote.interestRate) * 100).toFixed(2)}% / yr`} />
            <NoteRow label="Term" value={`${activeNote.termMonths} months`} />
            <NoteRow label="Payment" value={`$${Number(activeNote.paymentAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}/mo`} />
            <NoteRow label="First Due" value={new Date(activeNote.firstPaymentDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })} />
            <NoteRow
              label="Balance"
              value={
                <span className={activeNote.status === 'PAID_OFF' ? 'text-green-600 font-medium' : ''}>
                  {activeNote.status === 'PAID_OFF'
                    ? 'Paid off'
                    : `$${Number(activeNote.balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                </span>
              }
            />
            {totalCollected > 0 && (
              <NoteRow
                label="Collected"
                value={`$${totalCollected.toLocaleString('en-US', { minimumFractionDigits: 2 })} of $${Number(activeNote.principal).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
              />
            )}
            {activeNote.status === 'DEFAULTED' && (
              <NoteRow label="Status" value={<span className="text-red-600 font-medium">Defaulted</span>} />
            )}
          </dl>

          {activeNote.notes && (
            <p className="mt-3 text-xs text-zinc-500">{activeNote.notes}</p>
          )}

          {showPayment && (
            <RecordPaymentForm dealId={dealId} noteId={activeNote.id} onClose={() => setShowPayment(false)} />
          )}

          {payments.length > 0 && (
            <div className="mt-4 pt-4 border-t border-zinc-100">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">Payment History</p>
              <div className="space-y-2">
                {payments.map(p => (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <span className="text-zinc-500">{new Date(p.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                    <span className="font-medium text-zinc-900">${Number(p.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Prior notes (non-active) */}
      {notes.filter(n => n !== activeNote).length > 0 && (
        <div className="mt-4 pt-4 border-t border-zinc-100">
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">Prior Notes</p>
          {notes.filter(n => n !== activeNote).map(n => (
            <div key={n.id} className="text-xs text-zinc-400 flex gap-2">
              <span>{new Date(n.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}</span>
              <span>${Number(n.principal).toLocaleString()} @ {(Number(n.interestRate) * 100).toFixed(1)}%</span>
              <span className="capitalize">{n.status.toLowerCase().replace('_', ' ')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function NoteRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="w-24 shrink-0 text-zinc-500">{label}</dt>
      <dd className="text-zinc-900">{value}</dd>
    </div>
  )
}

function Field({ label, error, children }: { label: string; error?: string[]; children: React.ReactNode }) {
  return (
    <div>
      {label && <label className="block text-xs font-medium text-zinc-600 mb-1">{label}</label>}
      {children}
      {error?.[0] && <p className="mt-1 text-xs text-red-600">{error[0]}</p>}
    </div>
  )
}
