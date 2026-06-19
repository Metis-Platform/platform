'use client'

import { useState, useTransition } from 'react'
import { useActionState } from 'react'
import { createLandComp, deleteLandComp, type LandCompFormState } from '@/lib/actions/land-comp'

export type LandCompData = {
  id: string
  address: string | null
  apn: string | null
  acres: string
  salePrice: string
  saleDate: string // ISO string
  sourceUrl: string | null
  notes: string | null
}

const initialState: LandCompFormState = {}

function CreateCompForm({ dealId, onClose }: { dealId: string; onClose: () => void }) {
  const boundAction = createLandComp.bind(null, dealId)
  const [state, formAction, pending] = useActionState(boundAction, initialState)

  if (!state.message && !state.errors && !pending && Object.keys(state).length === 0 && state !== initialState) {
    onClose()
  }

  return (
    <form action={formAction} className="space-y-3 pt-4 border-t border-zinc-100">
      {state.message && <p className="text-sm text-red-600">{state.message}</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Address" error={state.errors?.address}>
          <input type="text" name="address" placeholder="123 County Rd" className="input-base" />
        </Field>
        <Field label="APN" error={state.errors?.apn}>
          <input type="text" name="apn" placeholder="optional" className="input-base" />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Acres" error={state.errors?.acres}>
          <input type="number" name="acres" min="0.01" step="0.01" placeholder="2.5" className="input-base" />
        </Field>
        <Field label="Sale Price ($)" error={state.errors?.salePrice}>
          <input type="number" name="salePrice" min="0.01" step="0.01" placeholder="15000" className="input-base" />
        </Field>
        <Field label="Sale Date" error={state.errors?.saleDate}>
          <input type="date" name="saleDate" className="input-base" />
        </Field>
        <Field label="Source URL" error={state.errors?.sourceUrl}>
          <input type="text" name="sourceUrl" placeholder="optional" className="input-base" />
        </Field>
      </div>

      <Field label="Notes (optional)" error={state.errors?.notes}>
        <textarea name="notes" rows={2} placeholder="Listing context, condition, terms…" className="input-base resize-none" />
      </Field>

      <div className="flex gap-3">
        <button type="submit" disabled={pending}
          className="px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors">
          {pending ? 'Saving…' : 'Add Comp'}
        </button>
        <button type="button" onClick={onClose}
          className="px-4 py-2 text-sm text-zinc-500 hover:text-zinc-700 transition-colors">
          Cancel
        </button>
      </div>
    </form>
  )
}

function CompRow({ dealId, comp }: { dealId: string; comp: LandCompData }) {
  const [isPending, startTransition] = useTransition()
  const acres = Number(comp.acres)
  const salePrice = Number(comp.salePrice)
  const pricePerAcre = acres > 0 ? salePrice / acres : null

  return (
    <div className="flex items-start justify-between gap-3 py-2 text-sm">
      <div>
        <p className="font-medium text-zinc-900">
          {comp.address ?? comp.apn ?? 'Comp'}
          {comp.sourceUrl && (
            <a href={comp.sourceUrl} target="_blank" rel="noreferrer" className="ml-2 text-xs text-blue-600 hover:underline">
              source
            </a>
          )}
        </p>
        <p className="text-xs text-zinc-500">
          {acres.toLocaleString()} ac · ${salePrice.toLocaleString()} · {new Date(comp.saleDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
          {pricePerAcre != null && ` · $${pricePerAcre.toLocaleString('en-US', { maximumFractionDigits: 0 })}/ac`}
        </p>
        {comp.notes && <p className="mt-1 text-xs text-zinc-400">{comp.notes}</p>}
      </div>
      <button
        disabled={isPending}
        onClick={() => startTransition(() => deleteLandComp(dealId, comp.id))}
        className="text-xs text-zinc-400 hover:text-red-600 transition-colors disabled:opacity-50"
      >
        Remove
      </button>
    </div>
  )
}

export default function LandCompsSection({
  dealId,
  comps,
  subjectAcres,
}: {
  dealId: string
  comps: LandCompData[]
  subjectAcres: number | null
}) {
  const [showCreate, setShowCreate] = useState(false)

  const validComps = comps.filter(c => Number(c.acres) > 0)
  const avgPricePerAcre = validComps.length > 0
    ? validComps.reduce((sum, c) => sum + Number(c.salePrice) / Number(c.acres), 0) / validComps.length
    : null
  const impliedValue = avgPricePerAcre != null && subjectAcres != null ? avgPricePerAcre * subjectAcres : null

  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-zinc-900">Raw Land Comps</h2>
        {!showCreate && (
          <button onClick={() => setShowCreate(true)} className="text-xs text-violet-600 hover:text-violet-800 font-medium transition-colors">
            + Add Comp
          </button>
        )}
      </div>

      {comps.length === 0 && !showCreate && (
        <p className="text-sm text-zinc-400">No comps logged yet.</p>
      )}

      {showCreate && <CreateCompForm dealId={dealId} onClose={() => setShowCreate(false)} />}

      {comps.length > 0 && (
        <>
          <div className="divide-y divide-zinc-100">
            {comps.map(c => <CompRow key={c.id} dealId={dealId} comp={c} />)}
          </div>

          {avgPricePerAcre != null && (
            <div className="mt-4 pt-4 border-t border-zinc-100">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-zinc-400">Avg comp $/acre</dt>
                  <dd className="font-medium text-zinc-900">${avgPricePerAcre.toLocaleString('en-US', { maximumFractionDigits: 0 })}</dd>
                </div>
                {impliedValue != null && (
                  <div>
                    <dt className="text-xs text-zinc-400">Implied value (subject)</dt>
                    <dd className="font-medium text-zinc-900">${impliedValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}
        </>
      )}
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
