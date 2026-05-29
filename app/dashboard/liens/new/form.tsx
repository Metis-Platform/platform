'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { createLien } from '@/lib/actions/lien'
import type { CreateLienFormState } from '@/lib/actions/lien'
import type { Jurisdiction } from '@/app/generated/prisma'

const initialState: CreateLienFormState = {}

export function NewLienForm({ jurisdictions }: { jurisdictions: Jurisdiction[] }) {
  const [state, formAction, pending] = useActionState(createLien, initialState)

  return (
    <form action={formAction} className="space-y-0 bg-white rounded-xl border border-zinc-200 divide-y divide-zinc-100 overflow-hidden">

      {/* Global error */}
      {state.message && (
        <div className="px-6 py-4 bg-red-50 border-b border-red-200 text-sm text-red-700">
          {state.message}
        </div>
      )}

      {/* Section: Jurisdiction */}
      <section className="px-6 py-5 space-y-4">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Jurisdiction</h2>
        <Field label="State & County" required error={state.errors?.jurisdictionId}>
          <select
            name="jurisdictionId"
            required
            className="input-base"
          >
            <option value="">Select jurisdiction…</option>
            {jurisdictions.map(j => (
              <option key={j.id} value={j.id}>
                {j.stateName} — {j.county} County ({j.investmentType === 'LIEN' ? 'Lien State' : 'Deed State'})
              </option>
            ))}
          </select>
        </Field>
      </section>

      {/* Section: Property */}
      <section className="px-6 py-5 space-y-4">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Property</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="APN / Parcel Number" required error={state.errors?.apn}>
            <input
              type="text"
              name="apn"
              required
              placeholder="e.g. 12-34-56-7890-00-001"
              className="input-base font-mono"
            />
          </Field>
          <Field label="Property Address" error={state.errors?.address}>
            <input
              type="text"
              name="address"
              placeholder="123 Main St, Orlando FL 32801"
              className="input-base"
            />
          </Field>
        </div>
      </section>

      {/* Section: Certificate */}
      <section className="px-6 py-5 space-y-4">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Certificate Details</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Certificate Number" required error={state.errors?.certificateNumber}>
            <input
              type="text"
              name="certificateNumber"
              required
              placeholder="e.g. 2024-0001234"
              className="input-base font-mono"
            />
          </Field>
          <Field label="Issue Date" required error={state.errors?.issueDate}>
            <input
              type="date"
              name="issueDate"
              required
              className="input-base"
            />
          </Field>
          <Field label="Face Amount ($)" required error={state.errors?.faceAmount}>
            <input
              type="number"
              name="faceAmount"
              required
              min="0.01"
              step="0.01"
              placeholder="5000.00"
              className="input-base"
            />
          </Field>
          <Field label="Interest Rate (%)" required error={state.errors?.interestRate}>
            <input
              type="number"
              name="interestRate"
              required
              min="0"
              max="100"
              step="0.01"
              placeholder="18"
              className="input-base"
            />
          </Field>
        </div>
      </section>

      {/* Section: Notes */}
      <section className="px-6 py-5 space-y-4">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Notes</h2>
        <Field label="Notes (optional)" error={state.errors?.notes}>
          <textarea
            name="notes"
            rows={3}
            placeholder="Additional notes about this lien…"
            className="input-base resize-none"
          />
        </Field>
      </section>

      {/* Actions */}
      <div className="px-6 py-4 bg-zinc-50 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {pending ? 'Saving…' : 'Create Lien & Generate Deadlines'}
        </button>
        <Link href="/dashboard/liens" className="px-4 py-2 text-sm text-zinc-500 hover:text-zinc-700 transition-colors">
          Cancel
        </Link>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Field wrapper
// ---------------------------------------------------------------------------

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string
  required?: boolean
  error?: string[]
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-zinc-700 mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error?.[0] && <p className="mt-1 text-xs text-red-600">{error[0]}</p>}
    </div>
  )
}
