'use client'

import { useState, useMemo, useActionState } from 'react'
import Link from 'next/link'
import { createLien, createDeed, createForeclosure } from '@/lib/actions/lien'
import { createLand } from '@/lib/actions/land'
import { createWholesale } from '@/lib/actions/wholesale'
import { createFixFlip } from '@/lib/actions/fix-flip'
import { createBuyHold } from '@/lib/actions/buy-hold'
import { createMultifamily } from '@/lib/actions/multifamily'
import type { LienFormState } from '@/lib/actions/lien'
import type { LandFormState } from '@/lib/actions/land'
import type { WholesaleFormState } from '@/lib/actions/wholesale'
import type { FixFlipFormState } from '@/lib/actions/fix-flip'
import type { BuyHoldFormState } from '@/lib/actions/buy-hold'
import type { MultifamilyFormState } from '@/lib/actions/multifamily'
import type { Jurisdiction } from '@/app/generated/prisma'

const initialState: LienFormState = {}
const initialLandState: LandFormState = {}
const initialWholesaleState: WholesaleFormState = {}
const initialFixFlipState: FixFlipFormState = {}
const initialBuyHoldState: BuyHoldFormState = {}
const initialMultifamilyState: MultifamilyFormState = {}

type Preselected = { id: string; county: string; stateName: string; state: string; apn?: string } | null

/** Dispatcher — renders strategy-specific form without calling lien hooks for other strategies. */
export function NewLienForm({
  jurisdictions,
  strategy = 'TAX_LIEN',
  preselected = null,
}: {
  jurisdictions: Jurisdiction[]
  strategy?: string
  preselected?: Preselected
}) {
  if (strategy === 'LAND') return <NewLandForm jurisdictions={jurisdictions} />
  if (strategy === 'WHOLESALE') return <NewWholesaleForm jurisdictions={jurisdictions} />
  if (strategy === 'FIX_FLIP') return <NewFixFlipForm jurisdictions={jurisdictions} />
  if (strategy === 'BUY_HOLD') return <NewBuyHoldForm jurisdictions={jurisdictions} />
  if (strategy === 'MULTIFAMILY') return <NewMultifamilyForm jurisdictions={jurisdictions} />
  return <NewLienFormInner jurisdictions={jurisdictions} strategy={strategy} preselected={preselected} />
}

function NewLienFormInner({
  jurisdictions,
  strategy,
  preselected = null,
}: {
  jurisdictions: Jurisdiction[]
  strategy: string
  preselected?: Preselected
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
        {preselected ? (
          <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
            <input type="hidden" name="jurisdictionId" value={preselected.id} />
            <div>
              <p className="font-medium text-zinc-900">{preselected.county} County</p>
              <p className="text-sm text-zinc-500">{preselected.stateName}</p>
            </div>
            <Link
              href={`/dashboard/deals/new?strategy=${strategy}`}
              className="text-sm text-blue-600 hover:text-blue-700 transition-colors"
            >
              Change
            </Link>
          </div>
        ) : (
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
        )}
      </section>

      {/* Property */}
      <section className="px-6 py-5 space-y-4">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Property</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="APN / Parcel Number" error={state.errors?.apn}>
            <input type="text" name="apn" defaultValue={preselected?.apn} placeholder="e.g. 12-34-56-7890-00-001" className="input-base font-mono" />
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

function NewWholesaleForm({ jurisdictions }: { jurisdictions: Jurisdiction[] }) {
  const [state, formAction, pending] = useActionState(createWholesale, initialWholesaleState)
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
      {state.message && (
        <div className="px-6 py-4 bg-red-50 text-sm text-red-700">{state.message}</div>
      )}

      {/* Location */}
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
              {counties.map(j => <option key={j.id} value={j.id}>{j.county} County</option>)}
            </select>
          </Field>
        </div>
      </section>

      {/* Property */}
      <section className="px-6 py-5 space-y-4">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Property</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="APN / Parcel Number" error={state.errors?.apn}>
            <input type="text" name="apn" placeholder="e.g. 12-34-56-7890" className="input-base font-mono" />
          </Field>
          <Field label="Address (optional)" error={state.errors?.address}>
            <input type="text" name="address" placeholder="123 Main St, Anytown TX 78701" className="input-base" />
          </Field>
        </div>
      </section>

      {/* Lead Info */}
      <section className="px-6 py-5 space-y-4">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Lead Info (optional)</h2>
        <Field label="Lead Source" error={state.errors?.leadSource}>
          <select name="leadSource" className="input-base">
            <option value="">Select…</option>
            <option value="Driving for Dollars">Driving for Dollars</option>
            <option value="Direct Mail">Direct Mail</option>
            <option value="Wholesaler">Wholesaler / JV</option>
            <option value="Referral">Referral</option>
            <option value="Online">Online / MLS</option>
            <option value="Other">Other</option>
          </select>
        </Field>
      </section>

      {/* Contract (optional) */}
      <section className="px-6 py-5 space-y-4">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Contract (optional)</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Contract Date" error={state.errors?.contractDate}>
            <input type="date" name="contractDate" className="input-base" />
          </Field>
          <Field label="Contract Price ($)" error={state.errors?.contractPrice}>
            <input type="number" name="contractPrice" min="0.01" step="0.01" placeholder="85000.00" className="input-base" />
          </Field>
          <Field label="Earnest Money ($)" error={state.errors?.earnestMoney}>
            <input type="number" name="earnestMoney" min="0.01" step="0.01" placeholder="1000.00" className="input-base" />
          </Field>
          <Field label="Assignment Fee ($)" error={state.errors?.assignmentFee}>
            <input type="number" name="assignmentFee" min="0.01" step="0.01" placeholder="10000.00" className="input-base" />
          </Field>
          <Field label="Inspection Deadline" error={state.errors?.inspectionDeadline}>
            <input type="date" name="inspectionDeadline" className="input-base" />
          </Field>
          <Field label="Closing Deadline" error={state.errors?.closingDeadline}>
            <input type="date" name="closingDeadline" className="input-base" />
          </Field>
        </div>
      </section>

      {/* Notes */}
      <section className="px-6 py-5">
        <Field label="Notes (optional)" error={state.errors?.notes}>
          <textarea name="notes" rows={2} placeholder="Deal notes, seller info…" className="input-base resize-none" />
        </Field>
      </section>

      <div className="px-6 py-4 bg-zinc-50 flex items-center gap-3">
        <button type="submit" disabled={pending}
          className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {pending ? 'Saving…' : 'Add Lead'}
        </button>
        <Link href="/dashboard/deals?strategy=WHOLESALE" className="ml-auto px-4 py-2 text-sm text-zinc-500 hover:text-zinc-700 transition-colors">Cancel</Link>
      </div>
    </form>
  )
}

function NewFixFlipForm({ jurisdictions }: { jurisdictions: Jurisdiction[] }) {
  const [state, formAction, pending] = useActionState(createFixFlip, initialFixFlipState)
  const [selectedState, setSelectedState] = useState('')

  const states = useMemo(() => {
    const seen = new Map<string, string>()
    for (const j of jurisdictions) seen.set(j.state, j.stateName)
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [jurisdictions])

  const counties = useMemo(
    () => jurisdictions.filter(j => j.state === selectedState).sort((a, b) => a.county.localeCompare(b.county)),
    [jurisdictions, selectedState],
  )

  return (
    <form action={formAction} className="rounded-xl border border-zinc-200 bg-white overflow-hidden divide-y divide-zinc-100">
      {state.error && (
        <div className="px-6 py-3 bg-red-50 border-b border-red-100 text-sm text-red-700">{state.error}</div>
      )}

      <section className="px-6 py-5 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-700">Location</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="State" error={state.fieldErrors?.jurisdictionId ? [state.fieldErrors.jurisdictionId] : undefined}>
            <select name="_state" value={selectedState} onChange={e => setSelectedState(e.target.value)}
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900">
              <option value="">Select state…</option>
              {states.map(([abbr, name]) => <option key={abbr} value={abbr}>{name}</option>)}
            </select>
          </Field>
          <Field label="County">
            <select name="jurisdictionId" required
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900">
              <option value="">Select county…</option>
              {counties.map(j => <option key={j.id} value={j.id}>{j.county}</option>)}
            </select>
          </Field>
        </div>
      </section>

      <section className="px-6 py-5 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-700">Property</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="APN" error={state.fieldErrors?.apn ? [state.fieldErrors.apn] : undefined}>
            <input name="apn" type="text" required placeholder="123-456-789"
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" />
          </Field>
          <Field label="Address">
            <input name="address" type="text" placeholder="123 Main St"
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" />
          </Field>
        </div>
      </section>

      <section className="px-6 py-5 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-700">Acquisition</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Purchase Price ($)">
            <input name="purchasePrice" type="number" min="0" step="1000"
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" />
          </Field>
          <Field label="Purchase Date">
            <input name="purchaseDate" type="date"
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" />
          </Field>
          <Field label="ARV ($)">
            <input name="arv" type="number" min="0" step="1000" placeholder="After repair value"
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" />
          </Field>
          <Field label="Rehab Budget ($)">
            <input name="rehabBudget" type="number" min="0" step="500"
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" />
          </Field>
        </div>
      </section>

      <section className="px-6 py-5 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-700">Rehab Timeline</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Rehab Start">
            <input name="rehabStartDate" type="date"
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" />
          </Field>
          <Field label="Target Completion">
            <input name="rehabTargetCompletion" type="date"
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" />
          </Field>
          <Field label="Target Listing Date">
            <input name="listingDate" type="date"
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" />
          </Field>
          <Field label="Est. Holding Costs ($)">
            <input name="holdingCostEstimate" type="number" min="0" step="100"
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" />
          </Field>
        </div>
      </section>

      <section className="px-6 py-5 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-700">Contractor</h2>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Name">
            <input name="contractorName" type="text"
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" />
          </Field>
          <Field label="Phone">
            <input name="contractorPhone" type="tel"
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" />
          </Field>
          <Field label="Email">
            <input name="contractorEmail" type="email"
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" />
          </Field>
        </div>
        <Field label="Permit Status">
          <select name="permitStatus"
            className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900">
            <option value="">— not set —</option>
            <option value="NOT_REQUIRED">Not required</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="ISSUED">Issued</option>
            <option value="FAILED">Failed inspection</option>
            <option value="CLOSED">Closed out</option>
          </select>
        </Field>
      </section>

      <div className="px-6 py-4 bg-zinc-50 flex items-center gap-3">
        <button type="submit" disabled={pending}
          className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {pending ? 'Saving…' : 'Add Deal'}
        </button>
        <Link href="/dashboard/deals?strategy=FIX_FLIP" className="ml-auto px-4 py-2 text-sm text-zinc-500 hover:text-zinc-700 transition-colors">Cancel</Link>
      </div>
    </form>
  )
}

function NewBuyHoldForm({ jurisdictions }: { jurisdictions: Jurisdiction[] }) {
  const [state, formAction, pending] = useActionState(createBuyHold, initialBuyHoldState)
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
      {state.error && (
        <div className="px-6 py-4 bg-red-50 text-sm text-red-700">{state.error}</div>
      )}

      {/* Location */}
      <section className="px-6 py-5 space-y-4">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Location</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="State" error={state.fieldErrors?.jurisdictionId ? [state.fieldErrors.jurisdictionId] : undefined}>
            <select value={selectedState} onChange={e => setSelectedState(e.target.value)} className="input-base">
              <option value="">Select state…</option>
              {states.map(([abbr, name]) => <option key={abbr} value={abbr}>{name}</option>)}
            </select>
          </Field>
          <Field label="County" error={state.fieldErrors?.jurisdictionId ? [state.fieldErrors.jurisdictionId] : undefined}>
            <select name="jurisdictionId" disabled={!selectedState} className="input-base disabled:opacity-50 disabled:cursor-not-allowed">
              <option value="">{selectedState ? 'Select county…' : '← Select state first'}</option>
              {counties.map(j => <option key={j.id} value={j.id}>{j.county} County</option>)}
            </select>
          </Field>
          <Field label="APN / Parcel Number" error={state.fieldErrors?.apn ? [state.fieldErrors.apn] : undefined}>
            <input type="text" name="apn" placeholder="e.g. 12-34-56-7890" className="input-base font-mono" />
          </Field>
          <Field label="Address (optional)">
            <input type="text" name="address" placeholder="123 Main St, Orlando FL 32801" className="input-base" />
          </Field>
        </div>
      </section>

      {/* Acquisition */}
      <section className="px-6 py-5 space-y-4">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Acquisition (optional)</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Purchase Price ($)">
            <input type="number" name="purchasePrice" min="0" step="1" placeholder="175000" className="input-base" />
          </Field>
          <Field label="Purchase Date">
            <input type="date" name="purchaseDate" className="input-base" />
          </Field>
        </div>
      </section>

      {/* Rental */}
      <section className="px-6 py-5 space-y-4">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Rental (optional)</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Rental Strategy">
            <select name="rentalStrategy" className="input-base">
              <option value="">— select —</option>
              <option value="LONG_TERM">Long-Term Rental</option>
              <option value="SHORT_TERM">Short-Term Rental (STR)</option>
              <option value="MID_TERM">Mid-Term Rental</option>
              <option value="SECTION_8">Section 8 / HCV</option>
            </select>
          </Field>
          <Field label="Target Monthly Rent ($)">
            <input type="number" name="targetMonthlyRent" min="0" step="1" placeholder="1800" className="input-base" />
          </Field>
          <Field label="Actual Monthly Rent ($)">
            <input type="number" name="actualMonthlyRent" min="0" step="1" placeholder="1750" className="input-base" />
          </Field>
          <Field label="Security Deposit ($)">
            <input type="number" name="securityDeposit" min="0" step="1" placeholder="1800" className="input-base" />
          </Field>
        </div>
      </section>

      {/* Lease */}
      <section className="px-6 py-5 space-y-4">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Lease &amp; Tenant (optional)</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Lease Start">
            <input type="date" name="leaseStartDate" className="input-base" />
          </Field>
          <Field label="Lease End">
            <input type="date" name="leaseEndDate" className="input-base" />
          </Field>
          <Field label="Tenant Name">
            <input type="text" name="tenantName" placeholder="Jane Smith" className="input-base" />
          </Field>
          <Field label="Tenant Phone">
            <input type="tel" name="tenantPhone" placeholder="(555) 123-4567" className="input-base" />
          </Field>
          <Field label="Tenant Email">
            <input type="email" name="tenantEmail" placeholder="tenant@email.com" className="input-base" />
          </Field>
          <Field label="Maint. Reserve / Mo ($)">
            <input type="number" name="maintenanceReserve" min="0" step="1" placeholder="150" className="input-base" />
          </Field>
        </div>
      </section>

      {/* Notes */}
      <section className="px-6 py-5">
        <Field label="Notes (optional)">
          <textarea name="notes" rows={3} placeholder="Property notes, deal source…" className="input-base resize-none" />
        </Field>
      </section>

      <div className="px-6 py-4 bg-zinc-50 flex items-center gap-3">
        <button type="submit" disabled={pending}
          className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {pending ? 'Saving…' : 'Add Property'}
        </button>
        <Link href="/dashboard/deals?strategy=BUY_HOLD" className="ml-auto px-4 py-2 text-sm text-zinc-500 hover:text-zinc-700 transition-colors">Cancel</Link>
      </div>
    </form>
  )
}

function NewMultifamilyForm({ jurisdictions }: { jurisdictions: Jurisdiction[] }) {
  const [state, formAction, pending] = useActionState(createMultifamily, initialMultifamilyState)
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
      {state.error && (
        <div className="px-6 py-4 bg-red-50 text-sm text-red-700">{state.error}</div>
      )}

      <section className="px-6 py-5 space-y-4">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Location</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="State" error={state.fieldErrors?.jurisdictionId ? [state.fieldErrors.jurisdictionId] : undefined}>
            <select value={selectedState} onChange={e => setSelectedState(e.target.value)} className="input-base">
              <option value="">Select state…</option>
              {states.map(([abbr, name]) => <option key={abbr} value={abbr}>{name}</option>)}
            </select>
          </Field>
          <Field label="County" error={state.fieldErrors?.jurisdictionId ? [state.fieldErrors.jurisdictionId] : undefined}>
            <select name="jurisdictionId" disabled={!selectedState} className="input-base disabled:opacity-50 disabled:cursor-not-allowed">
              <option value="">{selectedState ? 'Select county…' : '← Select state first'}</option>
              {counties.map(j => <option key={j.id} value={j.id}>{j.county} County</option>)}
            </select>
          </Field>
          <Field label="APN / Parcel Number" error={state.fieldErrors?.apn ? [state.fieldErrors.apn] : undefined}>
            <input type="text" name="apn" placeholder="e.g. 12-34-56-7890" className="input-base font-mono" />
          </Field>
          <Field label="Address (optional)">
            <input type="text" name="address" placeholder="123 Main St, Chicago IL 60601" className="input-base" />
          </Field>
        </div>
      </section>

      <section className="px-6 py-5 space-y-4">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Acquisition (optional)</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Purchase Price ($)">
            <input type="number" name="purchasePrice" min="0" step="1000" placeholder="1250000" className="input-base" />
          </Field>
          <Field label="Purchase Date">
            <input type="date" name="purchaseDate" className="input-base" />
          </Field>
        </div>
      </section>

      <section className="px-6 py-5 space-y-4">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Units &amp; Income (optional)</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Unit Count">
            <input type="number" name="unitCount" min="2" step="1" placeholder="12" className="input-base" />
          </Field>
          <Field label="Avg Monthly Rent / Unit ($)">
            <input type="number" name="averageMonthlyRent" min="0" step="50" placeholder="1200" className="input-base" />
          </Field>
          <Field label="Vacancy Rate (%)">
            <input type="number" name="vacancyRate" min="0" max="100" step="0.5" placeholder="5" className="input-base" />
          </Field>
          <Field label="Annual Operating Expenses ($)">
            <input type="number" name="annualOpex" min="0" step="500" placeholder="45000" className="input-base" />
          </Field>
        </div>
      </section>

      <section className="px-6 py-5 space-y-4">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Loan (optional)</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Loan Amount ($)">
            <input type="number" name="loanAmount" min="0" step="1000" placeholder="900000" className="input-base" />
          </Field>
          <Field label="Interest Rate (%)">
            <input type="number" name="interestRate" min="0" max="30" step="0.125" placeholder="6.5" className="input-base" />
          </Field>
          <Field label="Amortization (years)">
            <input type="number" name="amortizationYears" min="1" max="40" step="1" placeholder="30" className="input-base" />
          </Field>
          <Field label="Loan Maturity Date">
            <input type="date" name="loanMaturityDate" className="input-base" />
          </Field>
        </div>
      </section>

      <section className="px-6 py-5">
        <Field label="Notes (optional)">
          <textarea name="notes" rows={3} placeholder="Deal notes, source, underwriting assumptions…" className="input-base resize-none" />
        </Field>
      </section>

      <div className="px-6 py-4 bg-zinc-50 flex items-center gap-3">
        <button type="submit" disabled={pending}
          className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {pending ? 'Saving…' : 'Add Property'}
        </button>
        <Link href="/dashboard/deals?strategy=MULTIFAMILY" className="ml-auto px-4 py-2 text-sm text-zinc-500 hover:text-zinc-700 transition-colors">Cancel</Link>
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
