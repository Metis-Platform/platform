'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { convertToActive } from '@/lib/actions/lien'
import type { LienFormState } from '@/lib/actions/lien'

const initialState: LienFormState = {}

export function ConvertForm({ dealId }: { dealId: string }) {
  const boundAction = convertToActive.bind(null, dealId)
  const [state, formAction, pending] = useActionState(boundAction, initialState)

  return (
    <form action={formAction} className="bg-white rounded-xl border border-zinc-200 divide-y divide-zinc-100 overflow-hidden">
      {state.message && <div className="px-6 py-4 bg-red-50 text-sm text-red-700">{state.message}</div>}

      <section className="px-6 py-5 space-y-4">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Certificate Details</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Certificate Number" error={state.errors?.certificateNumber}>
            <input type="text" name="certificateNumber" placeholder="e.g. 2024-0001234" className="input-base font-mono" />
          </Field>
          <Field label="Issue Date" error={state.errors?.issueDate}>
            <input type="date" name="issueDate" className="input-base" />
          </Field>
          <Field label="Face Amount ($)" error={state.errors?.faceAmount}>
            <input type="number" name="faceAmount" min="0.01" step="0.01" placeholder="5000.00" className="input-base" />
          </Field>
          <Field label="Interest Rate (%)" error={state.errors?.interestRate}>
            <input type="number" name="interestRate" min="0" max="100" step="0.01" placeholder="18" className="input-base" />
          </Field>
        </div>
      </section>

      <section className="px-6 py-5">
        <Field label="Notes (optional)" error={state.errors?.notes}>
          <textarea name="notes" rows={2} placeholder="Any notes about this purchase…" className="input-base resize-none" />
        </Field>
      </section>

      <div className="px-6 py-4 bg-zinc-50 flex items-center gap-3">
        <button type="submit" disabled={pending}
          className="px-5 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors">
          {pending ? 'Converting…' : 'Mark as Won & Generate Deadlines'}
        </button>
        <Link href={`/dashboard/liens/${dealId}`} className="px-4 py-2 text-sm text-zinc-500 hover:text-zinc-700">Cancel</Link>
      </div>
    </form>
  )
}

function Field({ label, error, children }: { label: string; error?: string[]; children: React.ReactNode }) {
  return (
    <div>
      {label && <label className="block text-sm font-medium text-zinc-700 mb-1.5">{label}</label>}
      {children}
      {error?.[0] && <p className="mt-1 text-xs text-red-600">{error[0]}</p>}
    </div>
  )
}
