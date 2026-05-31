'use client'

import { useState, useMemo, useActionState } from 'react'
import Link from 'next/link'
import { updateLien } from '@/lib/actions/lien'
import type { LienFormState } from '@/lib/actions/lien'
import type { Jurisdiction } from '@/app/generated/prisma'

type DealWithLien = {
  id: string
  notes: string | null
  property: {
    apn: string
    address: string | null
    jurisdiction: Jurisdiction
  }
  taxLien: {
    certificateNumber: string | null
    faceAmount: { toString(): string } | null
    interestRate: { toString(): string } | null
    issueDate: Date | null
  } | null
}

const initialState: LienFormState = {}

export function EditLienForm({ deal, jurisdictions }: { deal: DealWithLien; jurisdictions: Jurisdiction[] }) {
  const boundAction = updateLien.bind(null, deal.id)
  const [state, formAction, pending] = useActionState(boundAction, initialState)

  const currentJur = deal.property.jurisdiction
  const [selectedState, setSelectedState] = useState(currentJur.state)

  const states = useMemo(() => {
    const seen = new Map<string, string>()
    for (const j of jurisdictions) seen.set(j.state, j.stateName)
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [jurisdictions])

  const counties = useMemo(
    () => jurisdictions.filter(j => j.state === selectedState),
    [jurisdictions, selectedState],
  )

  const lien = deal.taxLien
  const ratePercent = lien ? (Number(lien.interestRate) * 100).toFixed(2) : ''
  const issueDateStr = lien?.issueDate ? new Date(lien.issueDate).toISOString().slice(0, 10) : ''

  return (
    <form action={formAction} className="bg-white rounded-xl border border-zinc-200 divide-y divide-zinc-100 overflow-hidden">

      {state.message && (
        <div className="px-6 py-4 bg-red-50 text-sm text-red-700">{state.message}</div>
      )}

      {/* Jurisdiction */}
      <section className="px-6 py-5 space-y-4">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Jurisdiction</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="State" error={state.errors?.jurisdictionId}>
            <select value={selectedState} onChange={e => setSelectedState(e.target.value)} className="input-base">
              {states.map(([abbr, name]) => <option key={abbr} value={abbr}>{name}</option>)}
            </select>
          </Field>
          <Field label="County" error={state.errors?.jurisdictionId}>
            <select name="jurisdictionId" className="input-base" defaultValue={currentJur.id}>
              {counties.map(j => (
                <option key={j.id} value={j.id}>
                  {j.county} County ({j.investmentType === 'LIEN' ? 'Lien' : j.investmentType === 'REDEEMABLE_DEED' ? 'Redeemable Deed' : 'Deed'})
                </option>
              ))}
            </select>
          </Field>
        </div>
      </section>

      {/* Property */}
      <section className="px-6 py-5 space-y-4">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Property</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="APN / Parcel Number" error={state.errors?.apn}>
            <input type="text" name="apn" defaultValue={deal.property.apn}
              placeholder="e.g. 12-34-56-7890-00-001" className="input-base font-mono" />
          </Field>
          <Field label="Property Address (optional)" error={state.errors?.address}>
            <input type="text" name="address" defaultValue={deal.property.address ?? ''}
              placeholder="123 Main St, Orlando FL 32801" className="input-base" />
          </Field>
        </div>
      </section>

      {/* Certificate Details */}
      <section className="px-6 py-5 space-y-4">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Certificate Details</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Certificate Number" error={state.errors?.certificateNumber}>
            <input type="text" name="certificateNumber" defaultValue={lien?.certificateNumber ?? ''}
              placeholder="e.g. 2024-0001234" className="input-base font-mono" />
          </Field>
          <Field label="Issue Date" error={state.errors?.issueDate}>
            <input type="date" name="issueDate" defaultValue={issueDateStr} className="input-base" />
          </Field>
          <Field label="Face Amount ($)" error={state.errors?.faceAmount}>
            <input type="number" name="faceAmount" defaultValue={lien ? Number(lien.faceAmount).toFixed(2) : ''}
              min="0.01" step="0.01" className="input-base" />
          </Field>
          <Field label="Interest Rate (%)" error={state.errors?.interestRate}>
            <input type="number" name="interestRate" defaultValue={ratePercent}
              min="0" max="100" step="0.01" className="input-base" />
          </Field>
        </div>
      </section>

      {/* Notes */}
      <section className="px-6 py-5 space-y-4">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Notes (optional)</h2>
        <Field label="" error={state.errors?.notes}>
          <textarea name="notes" rows={3} defaultValue={deal.notes ?? ''}
            placeholder="Additional notes…" className="input-base resize-none" />
        </Field>
      </section>

      <div className="px-6 py-4 bg-zinc-50 flex items-center gap-3">
        <button type="submit" disabled={pending}
          className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          {pending ? 'Saving…' : 'Save Changes'}
        </button>
        <Link href={`/dashboard/deals/${deal.id}`}
          className="px-4 py-2 text-sm text-zinc-500 hover:text-zinc-700 transition-colors">
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
