'use client'

import { useState, useMemo, useActionState } from 'react'
import Link from 'next/link'
import { createLien, createDeed, createForeclosure } from '@/lib/actions/lien'
import { createLand } from '@/lib/actions/land'
import type { LienFormState } from '@/lib/actions/lien'
import type { LandFormState } from '@/lib/actions/land'
import type { Jurisdiction } from '@/app/generated/prisma'

const initialState: LienFormState = {}
const initialLandState: LandFormState = {}

/** Dispatcher — renders strategy-specific form without calling lien hooks for land. */
export function NewLienForm({
  jurisdictions,
  strategy = 'TAX_LIEN',
}: {
  jurisdictions: Jurisdiction[]
  strategy?: string
}) {
  if (strategy === 'LAND') return <NewLandForm jurisdictions={jurisdictions} />
  return <NewLienFormInner jurisdictions={jurisdictions} strategy={strategy} />
}

function NewLienFormInner({
  jurisdictions,
  strategy,
}: {
  jurisdictions: Jurisdiction[]
  strategy: string
}) {
  const isTaxDeed = strategy === 'TAX_DEED'
  const isForeclosure = strategy === 'FORECLOSURE'
  const action = isTaxDeed ? createDeed : isForeclosure ? createForeclosure : createLien

  const [state, formAction, pending] = useActionState(action, initialState)
  const [selectedState, setSelectedState] = useState('')

  const states = useMemo(() => {
    const seen = new Map<string, string>()
    for (const j of jurisdictions) seen.set(j.state, j.stateName)
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [jurisdictions])

  const counties = useMemo(
    () => jurisdictions.filter(j => j.state === selectedState),
    [jurisdictions, selectedState],
  )

  return (
    <form action={formAction} className="bg-white rounded-xl border border-zinc-200 divide-y divide-zinc-100 overflow-hidden">
      <input type="hidden" name="status" value="LEAD" />

      {state.message && (
        <div className="px-6 py-4 bg-red-50 text-sm text-red-700">{state.message}</div>
      )}

      {/* Jurisdiction */}
      <section className="px-6 py-5 space-y-4">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Jurisdiction</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="State" error={state.errors?.jurisdictionId}>
            <select value={selectedState} onChange={e => setSelectedState(e.target.value)} className="input-base">
              <option value="">Select state…</option>
              {states.map(([abbr, name]) => <option key={abbr} value={abbr}>{name}</option>)}
            </select>
          </Field>
          <Field label="County" error={state.errors?.jurisdictionId}>
            <select name="jurisdictionId" disabled={!selectedState} className="input-base disabled:opacity-50 disabled:cursor-not-allowed">
              <option value="">{selectedState ? 'Select county…' : '← Select state first'}</option>
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
            <input type="text" name="apn" placeholder="e.g. 12-34-56-7890-00-001" className="input-base font-mono" />
          </Field>
          <Field label="Property Address (optional)" error={state.errors?.address}>
            <input type="text" name="address" placeholder="123 Main St, Orlando FL 32801" className="input-base" />
          </Field>
        </div>
      </section>

      {/* Auction info (Tax Lien / Tax Deed leads) */}
      {!isForeclosure && (
        <section className="px-6 py-5 space-y-4">
          <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Auction Info (optional)</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Auction Date" error={state.errors?.auctionDate}>
              <input type="date" name="auctionDate" className="input-base" />
            </Field>
            <Field label="Max Bid ($)" error={state.errors?.maxBid}>
              <input type="number" name="maxBid" min="0.01" step="0.01" placeholder="5000.00" className="input-base" />
            </Field>
          </div>
        </section>
      )}

      {/* Foreclosure pre-bid info */}
      {isForeclosure && (
        <section className="px-6 py-5 space-y-4">
          <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Pre-Foreclosure Info</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Foreclosure Type" error={state.errors?.foreclosureType}>
              <select name="foreclosureType" className="input-base">
                <option value="MORTGAGE">Mortgage</option>
                <option value="TAX">Tax</option>
                <option value="HOA">HOA</option>
              </select>
            </Field>
            <Field label="Auction Date (optional)" error={state.errors?.auctionDate}>
              <input type="date" name="auctionDate" className="input-base" />
            </Field>
            <Field label="Max Bid ($) (optional)" error={state.errors?.maxBid}>
              <input type="number" name="maxBid" min="0.01" step="0.01" placeholder="75000.00" className="input-base" />
            </Field>
            <Field label="Estimated Junior Liens ($) (optional)" error={state.errors?.estimatedLiens}>
              <input type="number" name="estimatedLiens" min="0.01" step="0.01" placeholder="10000.00" className="input-base" />
            </Field>
          </div>
        </section>
      )}

      {/* Notes */}
      <section className="px-6 py-5">
        <Field label="Notes (optional)" error={state.errors?.notes}>
          <textarea name="notes" rows={3} placeholder="Research notes, due diligence…" className="input-base resize-none" />
        </Field>
      </section>

      <div className="px-6 py-4 bg-zinc-50 flex items-center gap-3">
        <button type="submit" disabled={pending}
          className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {pending ? 'Saving…' : 'Add to Watchlist'}
        </button>
        <p className="text-xs text-zinc-400">Converts to Active after winning at auction.</p>
        <Link href="/dashboard/deals" className="ml-auto px-4 py-2 text-sm text-zinc-500 hover:text-zinc-700 transition-colors">Cancel</Link>
      </div>
    </form>
  )
}

function NewLandForm({ jurisdictions }: { jurisdictions: Jurisdiction[] }) {
  const [state, formAction, pending] = useActionState(createLand, initialLandState)
  const [selectedState, setSelectedState] = useState('')

  const states = useMemo(() => {
    const seen = new Map<string, string>()
    for (const j of jurisdictions) seen.set(j.state, j.stateName)
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [jurisdictions])

  const counties = useMemo(
    () => jurisdictions.filter(j => j.state === selectedState),
    [jurisdictions, selectedState],
  )

  return (
    <form action={formAction} className="bg-white rounded-xl border border-zinc-200 divide-y divide-zinc-100 overflow-hidden">
      <input type="hidden" name="status" value="LEAD" />

      {state.message && (
        <div className="px-6 py-4 bg-red-50 text-sm text-red-700">{state.message}</div>
      )}

      {/* Jurisdiction */}
      <section className="px-6 py-5 space-y-4">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Location</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="State" error={state.errors?.jurisdictionId}>
            <select value={selectedState} onChange={e => setSelectedState(e.target.value)} className="input-base">
              <option value="">Select state…</option>
              {states.map(([abbr, name]) => <option key={abbr} value={abbr}>{name}</option>)}
            </select>
          </Field>
          <Field label="County" error={state.errors?.jurisdictionId}>
            <select name="jurisdictionId" disabled={!selectedState} className="input-base disabled:opacity-50 disabled:cursor-not-allowed">
              <option value="">{selectedState ? 'Select county…' : '← Select state first'}</option>
              {counties.map(j => (
                <option key={j.id} value={j.id}>{j.county} County</option>
              ))}
            </select>
          </Field>
        </div>
      </section>

      {/* Property */}
      <section className="px-6 py-5 space-y-4">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Parcel</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="APN / Parcel Number" error={state.errors?.apn}>
            <input type="text" name="apn" placeholder="e.g. 12-34-56-7890" className="input-base font-mono" />
          </Field>
          <Field label="Acres (optional)" error={state.errors?.acres}>
            <input type="number" name="acres" min="0" step="0.01" placeholder="10.00" className="input-base" />
          </Field>
          <Field label="Address / Legal Description (optional)" error={state.errors?.address}>
            <input type="text" name="address" placeholder="Rural Rd, Anytown TX 78701" className="input-base" />
          </Field>
          <Field label="Zoning (optional)" error={state.errors?.zoning}>
            <input type="text" name="zoning" placeholder="A-1 Agricultural" className="input-base" />
          </Field>
          <Field label="Access" error={state.errors?.access}>
            <select name="access" className="input-base">
              <option value="UNKNOWN">Unknown</option>
              <option value="ROAD">Road frontage</option>
              <option value="EASEMENT">Easement</option>
              <option value="LANDLOCKED">Landlocked</option>
              <option value="NONE">None confirmed</option>
            </select>
          </Field>
        </div>
      </section>

      {/* Option / Purchase */}
      <section className="px-6 py-5 space-y-4">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Option / Purchase</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Option Expiry Date (optional)" error={state.errors?.optionExpiry}>
            <input type="date" name="optionExpiry" className="input-base" />
          </Field>
          <Field label="Purchase Price ($) (optional)" error={state.errors?.purchasePrice}>
            <input type="number" name="purchasePrice" min="0.01" step="0.01" placeholder="15000.00" className="input-base" />
          </Field>
        </div>
      </section>

      {/* Notes */}
      <section className="px-6 py-5">
        <Field label="Notes (optional)" error={state.errors?.notes}>
          <textarea name="notes" rows={3} placeholder="Source, deal notes, seller contact…" className="input-base resize-none" />
        </Field>
      </section>

      <div className="px-6 py-4 bg-zinc-50 flex items-center gap-3">
        <button type="submit" disabled={pending}
          className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {pending ? 'Saving…' : 'Add to Watchlist'}
        </button>
        <Link href="/dashboard/deals?strategy=LAND" className="ml-auto px-4 py-2 text-sm text-zinc-500 hover:text-zinc-700 transition-colors">Cancel</Link>
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
