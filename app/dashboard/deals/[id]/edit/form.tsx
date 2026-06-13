'use client'

import { useState, useMemo, useActionState } from 'react'
import Link from 'next/link'
import { updateLien } from '@/lib/actions/lien'
import { updateLand } from '@/lib/actions/land'
import { updateWholesale } from '@/lib/actions/wholesale'
import { updateFixFlip } from '@/lib/actions/fix-flip'
import { updateBuyHold } from '@/lib/actions/buy-hold'
import { updateMultifamily } from '@/lib/actions/multifamily'
import type { LienFormState } from '@/lib/actions/lien'
import type { LandFormState } from '@/lib/actions/land'
import type { WholesaleFormState } from '@/lib/actions/wholesale'
import type { FixFlipFormState } from '@/lib/actions/fix-flip'
import type { BuyHoldFormState } from '@/lib/actions/buy-hold'
import type { MultifamilyFormState } from '@/lib/actions/multifamily'
import type { Jurisdiction, LandAccess } from '@/app/generated/prisma'

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

type DealWithLand = {
  id: string
  notes: string | null
  purchasePrice: { toString(): string } | null
  purchaseDate: Date | null
  property: {
    apn: string
    address: string | null
    acres: { toString(): string } | null
    jurisdiction: Jurisdiction
  }
  land: {
    zoning: string | null
    access: LandAccess | null
    floodZone: string | null
    wetlandsPercent: { toString(): string } | null
    hoaName: string | null
    hoaFees: { toString(): string } | null
    optionExpiry: Date | null
  } | null
}

const initialLandState: LandFormState = {}

export function EditLandForm({ deal, jurisdictions }: { deal: DealWithLand; jurisdictions: Jurisdiction[] }) {
  const boundAction = updateLand.bind(null, deal.id)
  const [state, formAction, pending] = useActionState(boundAction, initialLandState)

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

  const land = deal.land
  const optionExpiryStr = land?.optionExpiry ? new Date(land.optionExpiry).toISOString().slice(0, 10) : ''
  const purchaseDateStr = deal.purchaseDate ? new Date(deal.purchaseDate).toISOString().slice(0, 10) : ''

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
              {states.map(([abbr, name]) => <option key={abbr} value={abbr}>{name}</option>)}
            </select>
          </Field>
          <Field label="County" error={state.errors?.jurisdictionId}>
            <select name="jurisdictionId" className="input-base" defaultValue={currentJur.id}>
              {counties.map(j => (
                <option key={j.id} value={j.id}>{j.county} County</option>
              ))}
            </select>
          </Field>
        </div>
      </section>

      {/* Parcel */}
      <section className="px-6 py-5 space-y-4">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Parcel</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="APN / Parcel Number" error={state.errors?.apn}>
            <input type="text" name="apn" defaultValue={deal.property.apn} className="input-base font-mono" />
          </Field>
          <Field label="Acres" error={state.errors?.acres}>
            <input type="number" name="acres" min="0" step="0.01"
              defaultValue={deal.property.acres ? Number(deal.property.acres.toString()).toFixed(2) : ''}
              className="input-base" />
          </Field>
          <Field label="Address (optional)" error={state.errors?.address}>
            <input type="text" name="address" defaultValue={deal.property.address ?? ''} className="input-base" />
          </Field>
          <Field label="Zoning (optional)" error={state.errors?.zoning}>
            <input type="text" name="zoning" defaultValue={land?.zoning ?? ''} className="input-base" />
          </Field>
          <Field label="Access" error={state.errors?.access}>
            <select name="access" defaultValue={land?.access ?? 'UNKNOWN'} className="input-base">
              <option value="UNKNOWN">Unknown</option>
              <option value="ROAD">Road frontage</option>
              <option value="EASEMENT">Easement</option>
              <option value="LANDLOCKED">Landlocked</option>
              <option value="NONE">None confirmed</option>
            </select>
          </Field>
          <Field label="Flood Zone (optional)" error={state.errors?.floodZone}>
            <input type="text" name="floodZone" defaultValue={land?.floodZone ?? ''} placeholder="e.g. AE, X" className="input-base" />
          </Field>
          <Field label="Wetlands %" error={state.errors?.wetlandsPercent}>
            <input type="number" name="wetlandsPercent" min="0" max="100" step="0.1"
              defaultValue={land?.wetlandsPercent ? Number(land.wetlandsPercent.toString()).toFixed(1) : ''}
              className="input-base" />
          </Field>
          <Field label="HOA / POA Name (optional)" error={state.errors?.hoaName}>
            <input type="text" name="hoaName" defaultValue={land?.hoaName ?? ''} className="input-base" />
          </Field>
          <Field label="HOA Fees ($/yr, optional)" error={state.errors?.hoaFees}>
            <input type="number" name="hoaFees" min="0" step="0.01"
              defaultValue={land?.hoaFees ? Number(land.hoaFees.toString()).toFixed(2) : ''}
              className="input-base" />
          </Field>
        </div>
      </section>

      {/* Option / Purchase */}
      <section className="px-6 py-5 space-y-4">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Option / Purchase</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Option Expiry Date (optional)" error={state.errors?.optionExpiry}>
            <input type="date" name="optionExpiry" defaultValue={optionExpiryStr} className="input-base" />
          </Field>
          <Field label="Purchase Price ($) (optional)" error={state.errors?.purchasePrice}>
            <input type="number" name="purchasePrice" min="0.01" step="0.01"
              defaultValue={deal.purchasePrice ? Number(deal.purchasePrice.toString()).toFixed(2) : ''}
              className="input-base" />
          </Field>
          <Field label="Purchase Date (optional)" error={state.errors?.purchaseDate}>
            <input type="date" name="purchaseDate" defaultValue={purchaseDateStr} className="input-base" />
          </Field>
        </div>
      </section>

      {/* Notes */}
      <section className="px-6 py-5">
        <Field label="Notes (optional)" error={state.errors?.notes}>
          <textarea name="notes" rows={3} defaultValue={deal.notes ?? ''}
            placeholder="Source, deal notes, seller contact…" className="input-base resize-none" />
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

type DealWithWholesale = {
  id: string
  notes: string | null
  property: { apn: string; address: string | null; jurisdiction: Jurisdiction }
  wholesale: {
    leadSource: string | null
    contractDate: Date | null
    contractPrice: { toString(): string } | null
    earnestMoney: { toString(): string } | null
    inspectionDeadline: Date | null
    closingDeadline: Date | null
    assignmentFee: { toString(): string } | null
    buyerName: string | null
    buyerEmail: string | null
    buyerPhone: string | null
    marketingNotes: string | null
  } | null
}

const initialWholesaleState: WholesaleFormState = {}

export function EditWholesaleForm({ deal, jurisdictions }: { deal: DealWithWholesale; jurisdictions: Jurisdiction[] }) {
  const boundAction = updateWholesale.bind(null, deal.id)
  const [state, formAction, pending] = useActionState(boundAction, initialWholesaleState)

  const currentJur = deal.property.jurisdiction
  const [selectedState, setSelectedState] = useState(currentJur.state)

  const states = useMemo(() => {
    const seen = new Map<string, string>()
    for (const j of jurisdictions) seen.set(j.state, j.stateName)
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [jurisdictions])

  const counties = useMemo(() => jurisdictions.filter(j => j.state === selectedState), [jurisdictions, selectedState])

  const w = deal.wholesale
  const toDateStr = (d: Date | null) => d ? new Date(d).toISOString().slice(0, 10) : ''

  return (
    <form action={formAction} className="bg-white rounded-xl border border-zinc-200 divide-y divide-zinc-100 overflow-hidden">
      {state.message && <div className="px-6 py-4 bg-red-50 text-sm text-red-700">{state.message}</div>}

      {/* Location */}
      <section className="px-6 py-5 space-y-4">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Location</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="State" error={state.errors?.jurisdictionId}>
            <select value={selectedState} onChange={e => setSelectedState(e.target.value)} className="input-base">
              {states.map(([abbr, name]) => <option key={abbr} value={abbr}>{name}</option>)}
            </select>
          </Field>
          <Field label="County" error={state.errors?.jurisdictionId}>
            <select name="jurisdictionId" className="input-base" defaultValue={currentJur.id}>
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
            <input type="text" name="apn" defaultValue={deal.property.apn} className="input-base font-mono" />
          </Field>
          <Field label="Address (optional)" error={state.errors?.address}>
            <input type="text" name="address" defaultValue={deal.property.address ?? ''} className="input-base" />
          </Field>
        </div>
      </section>

      {/* Lead Info */}
      <section className="px-6 py-5 space-y-4">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Lead Info</h2>
        <Field label="Lead Source" error={state.errors?.leadSource}>
          <select name="leadSource" className="input-base" defaultValue={w?.leadSource ?? ''}>
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

      {/* Contract */}
      <section className="px-6 py-5 space-y-4">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Contract</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Contract Date" error={state.errors?.contractDate}>
            <input type="date" name="contractDate" defaultValue={toDateStr(w?.contractDate ?? null)} className="input-base" />
          </Field>
          <Field label="Contract Price ($)" error={state.errors?.contractPrice}>
            <input type="number" name="contractPrice" min="0.01" step="0.01"
              defaultValue={w?.contractPrice ? Number(w.contractPrice.toString()).toFixed(2) : ''}
              className="input-base" />
          </Field>
          <Field label="Earnest Money ($)" error={state.errors?.earnestMoney}>
            <input type="number" name="earnestMoney" min="0.01" step="0.01"
              defaultValue={w?.earnestMoney ? Number(w.earnestMoney.toString()).toFixed(2) : ''}
              className="input-base" />
          </Field>
          <Field label="Assignment Fee ($)" error={state.errors?.assignmentFee}>
            <input type="number" name="assignmentFee" min="0.01" step="0.01"
              defaultValue={w?.assignmentFee ? Number(w.assignmentFee.toString()).toFixed(2) : ''}
              className="input-base" />
          </Field>
          <Field label="Inspection Deadline" error={state.errors?.inspectionDeadline}>
            <input type="date" name="inspectionDeadline" defaultValue={toDateStr(w?.inspectionDeadline ?? null)} className="input-base" />
          </Field>
          <Field label="Closing Deadline" error={state.errors?.closingDeadline}>
            <input type="date" name="closingDeadline" defaultValue={toDateStr(w?.closingDeadline ?? null)} className="input-base" />
          </Field>
        </div>
      </section>

      {/* Buyer */}
      <section className="px-6 py-5 space-y-4">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Buyer (optional)</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Buyer Name" error={state.errors?.buyerName}>
            <input type="text" name="buyerName" defaultValue={w?.buyerName ?? ''} className="input-base" />
          </Field>
          <Field label="Buyer Email" error={state.errors?.buyerEmail}>
            <input type="email" name="buyerEmail" defaultValue={w?.buyerEmail ?? ''} className="input-base" />
          </Field>
          <Field label="Buyer Phone" error={state.errors?.buyerPhone}>
            <input type="tel" name="buyerPhone" defaultValue={w?.buyerPhone ?? ''} className="input-base" />
          </Field>
        </div>
      </section>

      {/* Notes */}
      <section className="px-6 py-5 space-y-4">
        <Field label="Notes (optional)" error={state.errors?.notes}>
          <textarea name="notes" rows={2} defaultValue={deal.notes ?? ''} className="input-base resize-none" />
        </Field>
        <Field label="Marketing Notes (optional)" error={state.errors?.marketingNotes}>
          <textarea name="marketingNotes" rows={2} defaultValue={w?.marketingNotes ?? ''} className="input-base resize-none" />
        </Field>
      </section>

      <div className="px-6 py-4 bg-zinc-50 flex items-center gap-3">
        <button type="submit" disabled={pending}
          className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          {pending ? 'Saving…' : 'Save Changes'}
        </button>
        <Link href={`/dashboard/deals/${deal.id}`} className="px-4 py-2 text-sm text-zinc-500 hover:text-zinc-700 transition-colors">Cancel</Link>
      </div>
    </form>
  )
}

type DealWithFixFlip = {
  id: string
  purchasePrice: { toString(): string } | null
  purchaseDate: Date | null
  notes: string | null
  property: { apn: string; address: string | null; jurisdiction: Jurisdiction }
  fixFlip: {
    arv: { toString(): string } | null
    rehabBudget: { toString(): string } | null
    rehabActualCost: { toString(): string } | null
    holdingCostEstimate: { toString(): string } | null
    rehabStartDate: Date | null
    rehabTargetCompletion: Date | null
    rehabCompletedDate: Date | null
    listingDate: Date | null
    listingPrice: { toString(): string } | null
    acceptedOfferDate: Date | null
    acceptedOfferPrice: { toString(): string } | null
    closingDate: Date | null
    contractorName: string | null
    contractorPhone: string | null
    contractorEmail: string | null
    permitStatus: string | null
  } | null
}

const initialFixFlipState: FixFlipFormState = {}

export function EditFixFlipForm({ deal }: { deal: DealWithFixFlip }) {
  const boundAction = updateFixFlip.bind(null, deal.id)
  const [state, formAction, pending] = useActionState(boundAction, initialFixFlipState)

  const f = deal.fixFlip
  const toDateStr = (d: Date | null) => d ? new Date(d).toISOString().slice(0, 10) : ''
  const toNumStr  = (v: { toString(): string } | null) => v ? Number(v.toString()).toString() : ''

  return (
    <form action={formAction} className="bg-white rounded-xl border border-zinc-200 divide-y divide-zinc-100 overflow-hidden">
      {state.error && <div className="px-6 py-4 bg-red-50 text-sm text-red-700">{state.error}</div>}

      <section className="px-6 py-5 space-y-4">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Acquisition</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Purchase Price ($)">
            <input type="number" name="purchasePrice" min="0" step="1000" defaultValue={toNumStr(deal.purchasePrice)} className="input-base" />
          </Field>
          <Field label="Purchase Date">
            <input type="date" name="purchaseDate" defaultValue={toDateStr(deal.purchaseDate)} className="input-base" />
          </Field>
          <Field label="ARV ($)">
            <input type="number" name="arv" min="0" step="1000" defaultValue={toNumStr(f?.arv ?? null)} className="input-base" />
          </Field>
          <Field label="Rehab Budget ($)">
            <input type="number" name="rehabBudget" min="0" step="500" defaultValue={toNumStr(f?.rehabBudget ?? null)} className="input-base" />
          </Field>
          <Field label="Actual Rehab Cost ($)">
            <input type="number" name="rehabActualCost" min="0" step="500" defaultValue={toNumStr(f?.rehabActualCost ?? null)} className="input-base" />
          </Field>
          <Field label="Est. Holding Costs ($)">
            <input type="number" name="holdingCostEstimate" min="0" step="100" defaultValue={toNumStr(f?.holdingCostEstimate ?? null)} className="input-base" />
          </Field>
        </div>
      </section>

      <section className="px-6 py-5 space-y-4">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Rehab Timeline</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Rehab Start">
            <input type="date" name="rehabStartDate" defaultValue={toDateStr(f?.rehabStartDate ?? null)} className="input-base" />
          </Field>
          <Field label="Target Completion">
            <input type="date" name="rehabTargetCompletion" defaultValue={toDateStr(f?.rehabTargetCompletion ?? null)} className="input-base" />
          </Field>
          <Field label="Actual Completion">
            <input type="date" name="rehabCompletedDate" defaultValue={toDateStr(f?.rehabCompletedDate ?? null)} className="input-base" />
          </Field>
          <Field label="Permit Status">
            <select name="permitStatus" className="input-base" defaultValue={f?.permitStatus ?? ''}>
              <option value="">— not set —</option>
              <option value="NOT_REQUIRED">Not required</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="ISSUED">Issued</option>
              <option value="FAILED">Failed inspection</option>
              <option value="CLOSED">Closed out</option>
            </select>
          </Field>
        </div>
      </section>

      <section className="px-6 py-5 space-y-4">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Contractor</h2>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Name">
            <input type="text" name="contractorName" defaultValue={f?.contractorName ?? ''} className="input-base" />
          </Field>
          <Field label="Phone">
            <input type="tel" name="contractorPhone" defaultValue={f?.contractorPhone ?? ''} className="input-base" />
          </Field>
          <Field label="Email">
            <input type="email" name="contractorEmail" defaultValue={f?.contractorEmail ?? ''} className="input-base" />
          </Field>
        </div>
      </section>

      <section className="px-6 py-5 space-y-4">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Disposition</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Target Listing Date">
            <input type="date" name="listingDate" defaultValue={toDateStr(f?.listingDate ?? null)} className="input-base" />
          </Field>
          <Field label="Listing Price ($)">
            <input type="number" name="listingPrice" min="0" step="1000" defaultValue={toNumStr(f?.listingPrice ?? null)} className="input-base" />
          </Field>
          <Field label="Offer Accepted Date">
            <input type="date" name="acceptedOfferDate" defaultValue={toDateStr(f?.acceptedOfferDate ?? null)} className="input-base" />
          </Field>
          <Field label="Accepted Offer Price ($)">
            <input type="number" name="acceptedOfferPrice" min="0" step="1000" defaultValue={toNumStr(f?.acceptedOfferPrice ?? null)} className="input-base" />
          </Field>
          <Field label="Closing Date">
            <input type="date" name="closingDate" defaultValue={toDateStr(f?.closingDate ?? null)} className="input-base" />
          </Field>
        </div>
      </section>

      <section className="px-6 py-5 space-y-4">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Notes</h2>
        <textarea name="notes" rows={3} defaultValue={deal.notes ?? ''} className="input-base w-full resize-none" />
      </section>

      <div className="px-6 py-4 bg-zinc-50 flex items-center gap-3">
        <button type="submit" disabled={pending}
          className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          {pending ? 'Saving…' : 'Save Changes'}
        </button>
        <Link href={`/dashboard/deals/${deal.id}`} className="px-4 py-2 text-sm text-zinc-500 hover:text-zinc-700 transition-colors">Cancel</Link>
      </div>
    </form>
  )
}

type DealWithBuyHold = {
  id: string
  notes: string | null
  purchasePrice: { toString(): string } | null
  purchaseDate: Date | null
  buyHold: {
    rentalStrategy: string | null
    targetMonthlyRent: { toString(): string } | null
    actualMonthlyRent: { toString(): string } | null
    securityDeposit: { toString(): string } | null
    leaseStartDate: Date | null
    leaseEndDate: Date | null
    tenantName: string | null
    tenantPhone: string | null
    tenantEmail: string | null
    propertyManagerName: string | null
    propertyManagerPhone: string | null
    propertyManagerEmail: string | null
    inspectionStatus: string | null
    maintenanceReserve: { toString(): string } | null
  } | null
}

export function EditBuyHoldForm({ deal }: { deal: DealWithBuyHold }) {
  const boundAction = updateBuyHold.bind(null, deal.id)
  const [state, formAction, pending] = useActionState(boundAction, {} as BuyHoldFormState)
  const bh = deal.buyHold

  function fmtDateInput(d: Date | null | undefined) {
    if (!d) return ''
    return new Date(d).toISOString().split('T')[0]
  }

  return (
    <form action={formAction} className="bg-white rounded-xl border border-zinc-200 divide-y divide-zinc-100 overflow-hidden">
      {state.error && <div className="px-6 py-4 bg-red-50 text-sm text-red-700">{state.error}</div>}

      {/* Acquisition */}
      <section className="px-6 py-5 space-y-4">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Acquisition</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Purchase Price ($)">
            <input type="number" name="purchasePrice" min="0" step="1"
              defaultValue={deal.purchasePrice?.toString() ?? ''} className="input-base" />
          </Field>
          <Field label="Purchase Date">
            <input type="date" name="purchaseDate"
              defaultValue={fmtDateInput(deal.purchaseDate)} className="input-base" />
          </Field>
        </div>
      </section>

      {/* Rental */}
      <section className="px-6 py-5 space-y-4">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Rental</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Rental Strategy">
            <select name="rentalStrategy" defaultValue={bh?.rentalStrategy ?? ''} className="input-base">
              <option value="">— select —</option>
              <option value="LONG_TERM">Long-Term Rental</option>
              <option value="SHORT_TERM">Short-Term Rental (STR)</option>
              <option value="MID_TERM">Mid-Term Rental</option>
              <option value="SECTION_8">Section 8 / HCV</option>
            </select>
          </Field>
          <Field label="Target Monthly Rent ($)">
            <input type="number" name="targetMonthlyRent" min="0" step="1"
              defaultValue={bh?.targetMonthlyRent?.toString() ?? ''} className="input-base" />
          </Field>
          <Field label="Actual Monthly Rent ($)">
            <input type="number" name="actualMonthlyRent" min="0" step="1"
              defaultValue={bh?.actualMonthlyRent?.toString() ?? ''} className="input-base" />
          </Field>
          <Field label="Security Deposit ($)">
            <input type="number" name="securityDeposit" min="0" step="1"
              defaultValue={bh?.securityDeposit?.toString() ?? ''} className="input-base" />
          </Field>
          <Field label="Maint. Reserve / Mo ($)">
            <input type="number" name="maintenanceReserve" min="0" step="1"
              defaultValue={bh?.maintenanceReserve?.toString() ?? ''} className="input-base" />
          </Field>
        </div>
      </section>

      {/* Lease & Tenant */}
      <section className="px-6 py-5 space-y-4">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Lease &amp; Tenant</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Lease Start">
            <input type="date" name="leaseStartDate"
              defaultValue={fmtDateInput(bh?.leaseStartDate)} className="input-base" />
          </Field>
          <Field label="Lease End">
            <input type="date" name="leaseEndDate"
              defaultValue={fmtDateInput(bh?.leaseEndDate)} className="input-base" />
          </Field>
          <Field label="Tenant Name">
            <input type="text" name="tenantName" defaultValue={bh?.tenantName ?? ''} className="input-base" />
          </Field>
          <Field label="Tenant Phone">
            <input type="tel" name="tenantPhone" defaultValue={bh?.tenantPhone ?? ''} className="input-base" />
          </Field>
          <Field label="Tenant Email">
            <input type="email" name="tenantEmail" defaultValue={bh?.tenantEmail ?? ''} className="input-base" />
          </Field>
          <Field label="Inspection Status">
            <select name="inspectionStatus" defaultValue={bh?.inspectionStatus ?? ''} className="input-base">
              <option value="">— not set —</option>
              <option value="PENDING">Pending</option>
              <option value="PASSED">Passed</option>
              <option value="FAILED">Failed</option>
              <option value="NA">Not required</option>
            </select>
          </Field>
        </div>
      </section>

      {/* Property Manager */}
      <section className="px-6 py-5 space-y-4">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Property Manager</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Manager Name">
            <input type="text" name="propertyManagerName"
              defaultValue={bh?.propertyManagerName ?? ''} className="input-base" />
          </Field>
          <Field label="Manager Phone">
            <input type="tel" name="propertyManagerPhone"
              defaultValue={bh?.propertyManagerPhone ?? ''} className="input-base" />
          </Field>
          <Field label="Manager Email">
            <input type="email" name="propertyManagerEmail"
              defaultValue={bh?.propertyManagerEmail ?? ''} className="input-base" />
          </Field>
        </div>
      </section>

      {/* Notes */}
      <section className="px-6 py-5 space-y-4">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Notes</h2>
        <textarea name="notes" rows={3} defaultValue={deal.notes ?? ''} className="input-base w-full resize-none" />
      </section>

      <div className="px-6 py-4 bg-zinc-50 flex items-center gap-3">
        <button type="submit" disabled={pending}
          className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          {pending ? 'Saving…' : 'Save Changes'}
        </button>
        <Link href={`/dashboard/deals/${deal.id}`} className="px-4 py-2 text-sm text-zinc-500 hover:text-zinc-700 transition-colors">Cancel</Link>
      </div>
    </form>
  )
}

type DealWithMultifamily = {
  id: string
  notes: string | null
  purchasePrice: { toString(): string } | null
  purchaseDate: Date | null
  multifamily: {
    unitCount: number | null
    occupiedUnits: number | null
    averageMonthlyRent: { toString(): string } | null
    vacancyRate: { toString(): string } | null
    operatingExpenses: unknown
    loanAmount: { toString(): string } | null
    interestRate: { toString(): string } | null
    amortizationYears: number | null
    loanMaturityDate: Date | null
    propertyManagerName: string | null
    propertyManagerPhone: string | null
    propertyManagerEmail: string | null
  } | null
}

export function EditMultifamilyForm({ deal }: { deal: DealWithMultifamily }) {
  const boundAction = updateMultifamily.bind(null, deal.id)
  const [state, formAction, pending] = useActionState(boundAction, {} as MultifamilyFormState)

  const mf = deal.multifamily
  const mfOpex = mf?.operatingExpenses as { total?: number } | null
  const vacancyPct = mf?.vacancyRate ? (Number(mf.vacancyRate) * 100).toFixed(1) : ''
  const ratePct = mf?.interestRate ? (Number(mf.interestRate) * 100).toFixed(3) : ''
  const maturityStr = mf?.loanMaturityDate ? new Date(mf.loanMaturityDate).toISOString().slice(0, 10) : ''
  const purchaseDateStr = deal.purchaseDate ? new Date(deal.purchaseDate).toISOString().slice(0, 10) : ''

  return (
    <form action={formAction} className="bg-white rounded-xl border border-zinc-200 divide-y divide-zinc-100 overflow-hidden">
      {state.error && (
        <div className="px-6 py-4 bg-red-50 text-sm text-red-700">{state.error}</div>
      )}

      <section className="px-6 py-5 space-y-4">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Acquisition</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Purchase Price ($)">
            <input type="number" name="purchasePrice" defaultValue={deal.purchasePrice ? Number(deal.purchasePrice) : ''}
              min="0" step="1000" className="input-base" />
          </Field>
          <Field label="Purchase Date">
            <input type="date" name="purchaseDate" defaultValue={purchaseDateStr} className="input-base" />
          </Field>
        </div>
      </section>

      <section className="px-6 py-5 space-y-4">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Units &amp; Income</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Unit Count">
            <input type="number" name="unitCount" defaultValue={mf?.unitCount ?? ''} min="2" step="1" className="input-base" />
          </Field>
          <Field label="Occupied Units">
            <input type="number" name="occupiedUnits" defaultValue={mf?.occupiedUnits ?? ''} min="0" step="1" className="input-base" />
          </Field>
          <Field label="Avg Monthly Rent / Unit ($)">
            <input type="number" name="averageMonthlyRent" defaultValue={mf?.averageMonthlyRent ? Number(mf.averageMonthlyRent) : ''}
              min="0" step="50" className="input-base" />
          </Field>
          <Field label="Vacancy Rate (%)">
            <input type="number" name="vacancyRate" defaultValue={vacancyPct} min="0" max="100" step="0.5" className="input-base" />
          </Field>
          <Field label="Annual Operating Expenses ($)">
            <input type="number" name="annualOpex" defaultValue={mfOpex?.total ?? ''} min="0" step="500" className="input-base" />
          </Field>
        </div>
      </section>

      <section className="px-6 py-5 space-y-4">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Loan</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Loan Amount ($)">
            <input type="number" name="loanAmount" defaultValue={mf?.loanAmount ? Number(mf.loanAmount) : ''}
              min="0" step="1000" className="input-base" />
          </Field>
          <Field label="Interest Rate (%)">
            <input type="number" name="interestRate" defaultValue={ratePct} min="0" max="30" step="0.125" className="input-base" />
          </Field>
          <Field label="Amortization (years)">
            <input type="number" name="amortizationYears" defaultValue={mf?.amortizationYears ?? ''} min="1" max="40" step="1" className="input-base" />
          </Field>
          <Field label="Loan Maturity Date">
            <input type="date" name="loanMaturityDate" defaultValue={maturityStr} className="input-base" />
          </Field>
        </div>
      </section>

      <section className="px-6 py-5 space-y-4">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Property Manager</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Name">
            <input type="text" name="propertyManagerName" defaultValue={mf?.propertyManagerName ?? ''} className="input-base" />
          </Field>
          <Field label="Phone">
            <input type="tel" name="propertyManagerPhone" defaultValue={mf?.propertyManagerPhone ?? ''} className="input-base" />
          </Field>
          <Field label="Email">
            <input type="email" name="propertyManagerEmail" defaultValue={mf?.propertyManagerEmail ?? ''} className="input-base" />
          </Field>
        </div>
      </section>

      <section className="px-6 py-5">
        <Field label="Notes">
          <textarea name="notes" rows={3} defaultValue={deal.notes ?? ''} className="input-base w-full resize-none" />
        </Field>
      </section>

      <div className="px-6 py-4 bg-zinc-50 flex items-center gap-3">
        <button type="submit" disabled={pending}
          className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          {pending ? 'Saving…' : 'Save Changes'}
        </button>
        <Link href={`/dashboard/deals/${deal.id}`} className="px-4 py-2 text-sm text-zinc-500 hover:text-zinc-700 transition-colors">Cancel</Link>
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
