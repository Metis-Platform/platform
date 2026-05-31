'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { updateLien } from '@/lib/actions/lien'
import type { LienFormState } from '@/lib/actions/lien'

// Inline type for the deal prop — matches the Prisma include shape from the page
type DealWithLien = {
  id: string
  notes: string | null
  taxLien: {
    certificateNumber: string | null
    faceAmount: { toString(): string } | null
    interestRate: { toString(): string } | null
    issueDate: Date | null
  } | null
}

const initialState: LienFormState = {}

export function EditLienForm({ deal }: { deal: DealWithLien }) {
  const boundAction = updateLien.bind(null, deal.id)
  const [state, formAction, pending] = useActionState(boundAction, initialState)

  const lien = deal.taxLien
  // Convert stored decimal rate back to percentage for the input (0.18 → 18)
  const ratePercent = lien ? (Number(lien.interestRate) * 100).toFixed(2) : ''
  // Format date as YYYY-MM-DD for the date input
  const issueDateStr = lien?.issueDate ? new Date(lien.issueDate).toISOString().slice(0, 10) : ''

  return (
    <form action={formAction} className="bg-white rounded-xl border border-zinc-200 divide-y divide-zinc-100 overflow-hidden">

      {state.message && (
        <div className="px-6 py-4 bg-red-50 text-sm text-red-700">{state.message}</div>
      )}

      <section className="px-6 py-5 space-y-4">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Certificate Details</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Certificate Number" error={state.errors?.certificateNumber}>
            <input
              type="text"
              name="certificateNumber"
              defaultValue={lien?.certificateNumber ?? ''}
              placeholder="e.g. 2024-0001234"
              className="input-base font-mono"
            />
          </Field>
          <Field label="Issue Date" error={state.errors?.issueDate}>
            <input type="date" name="issueDate" defaultValue={issueDateStr} className="input-base" />
          </Field>
          <Field label="Face Amount ($)" error={state.errors?.faceAmount}>
            <input
              type="number"
              name="faceAmount"
              defaultValue={lien ? Number(lien.faceAmount).toFixed(2) : ''}
              min="0.01"
              step="0.01"
              className="input-base"
            />
          </Field>
          <Field label="Interest Rate (%)" error={state.errors?.interestRate}>
            <input
              type="number"
              name="interestRate"
              defaultValue={ratePercent}
              min="0"
              max="100"
              step="0.01"
              className="input-base"
            />
          </Field>
        </div>
      </section>

      <section className="px-6 py-5 space-y-4">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Notes (optional)</h2>
        <Field label="" error={state.errors?.notes}>
          <textarea
            name="notes"
            rows={3}
            defaultValue={deal.notes ?? ''}
            placeholder="Additional notes…"
            className="input-base resize-none"
          />
        </Field>
      </section>

      <div className="px-6 py-4 bg-zinc-50 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {pending ? 'Saving…' : 'Save Changes'}
        </button>
        <Link
          href={`/dashboard/deals/${deal.id}`}
          className="px-4 py-2 text-sm text-zinc-500 hover:text-zinc-700 transition-colors"
        >
          Cancel
        </Link>
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
