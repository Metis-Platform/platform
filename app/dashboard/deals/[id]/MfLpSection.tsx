'use client'

import { useState, useActionState } from 'react'
import Link from 'next/link'
import { createLpInvestor, updateLpInvestor, deleteLpInvestor, upsertWaterfall } from '@/lib/actions/mf-lp'
import type { MfLpFormState, MfWaterfallFormState } from '@/lib/actions/mf-lp'
import { computeWaterfallDistribution, computeEquityPcts } from '@/lib/mf-waterfall'
import ContactPicker from '@/app/components/ContactPicker'
import type { ContactType } from '@/app/generated/prisma'

type ContactSummary = {
  id: string
  firstName: string | null
  lastName: string | null
  company: string | null
  email: string | null
  phone: string | null
  type: ContactType
}

export type LpInvestorRow = {
  id: string
  name: string
  email: string | null
  phone: string | null
  committedAmount: string
  fundedAmount: string
  equityPct: string | null
  notes: string | null
  contact: ContactSummary | null
}

export type WaterfallRow = {
  id: string
  preferredReturnRate: string
  lpSplit: string
  gpSplit: string
  promoteHurdle: string | null
  promoteCarry: string | null
  raisedDate: string | null
}

type Props = {
  dealId: string
  investors: LpInvestorRow[]
  waterfall: WaterfallRow | null
}

function fmt$(v: number) {
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function fmtPct(v: number) {
  return `${(v * 100).toFixed(1)}%`
}

// ─── Add / Edit investor inline form ────────────────────────

function InvestorForm({
  dealId,
  existing,
  onDone,
}: {
  dealId: string
  existing: LpInvestorRow | null
  onDone: () => void
}) {
  const action = existing
    ? updateLpInvestor.bind(null, dealId, existing.id)
    : createLpInvestor.bind(null, dealId)
  const [state, formAction, pending] = useActionState(action as (prev: MfLpFormState, fd: FormData) => Promise<MfLpFormState>, {})

  const toNum = (v: string | null, factor = 1) => v ? (Number(v) * factor).toFixed(2) : ''

  return (
    <form
      action={async (fd: FormData) => {
        await formAction(fd)
        onDone()
      }}
      className="space-y-3 p-4 bg-zinc-50 border border-zinc-200 rounded-lg"
    >
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-zinc-600 mb-1">Name *</label>
          <input
            name="name"
            required
            defaultValue={existing?.name ?? ''}
            placeholder="Jane Smith"
            className="input-base w-full"
          />
          {state.fieldErrors?.name && <p className="text-xs text-red-600 mt-0.5">{state.fieldErrors.name}</p>}
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-600 mb-1">Email</label>
          <input name="email" type="email" defaultValue={existing?.email ?? ''} className="input-base w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-600 mb-1">Phone</label>
          <input name="phone" type="tel" defaultValue={existing?.phone ?? ''} className="input-base w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-600 mb-1">Committed ($) *</label>
          <input
            name="committedAmount"
            type="number"
            min="0.01"
            step="0.01"
            required
            defaultValue={existing ? Number(existing.committedAmount).toFixed(2) : ''}
            className="input-base w-full"
          />
          {state.fieldErrors?.committedAmount && <p className="text-xs text-red-600 mt-0.5">{state.fieldErrors.committedAmount}</p>}
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-600 mb-1">Funded ($)</label>
          <input
            name="fundedAmount"
            type="number"
            min="0"
            step="0.01"
            defaultValue={existing ? Number(existing.fundedAmount).toFixed(2) : '0'}
            className="input-base w-full"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-600 mb-1">Equity % (leave blank to auto-compute)</label>
          <input
            name="equityPct"
            type="number"
            min="0"
            max="100"
            step="0.01"
            defaultValue={existing?.equityPct ? toNum(existing.equityPct, 100) : ''}
            placeholder="auto"
            className="input-base w-full"
          />
        </div>
      </div>

      <div>
        <ContactPicker
          name="contactId"
          initial={existing?.contact ?? null}
          label="Link to contact"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-600 mb-1">Notes</label>
        <textarea name="notes" rows={2} defaultValue={existing?.notes ?? ''} className="input-base w-full resize-none" />
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {pending ? 'Saving…' : existing ? 'Update' : 'Add Investor'}
        </button>
        <button type="button" onClick={onDone} className="px-4 py-1.5 text-sm text-zinc-500 hover:text-zinc-700">
          Cancel
        </button>
      </div>
    </form>
  )
}

// ─── Waterfall params form ───────────────────────────────────

function WaterfallForm({ dealId, existing, onDone }: { dealId: string; existing: WaterfallRow | null; onDone: () => void }) {
  const boundAction = upsertWaterfall.bind(null, dealId)
  const [state, formAction, pending] = useActionState<MfWaterfallFormState, FormData>(boundAction, {})

  const toRate = (v: string | null) => v ? (Number(v) * 100).toFixed(2) : ''

  return (
    <form
      action={async (fd: FormData) => {
        await formAction(fd)
        onDone()
      }}
      className="space-y-3 p-4 bg-zinc-50 border border-zinc-200 rounded-lg"
    >
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <label className="block text-xs font-medium text-zinc-600 mb-1">Preferred Return (%)</label>
          <input name="preferredReturnRate" type="number" min="0" max="30" step="0.1"
            defaultValue={toRate(existing?.preferredReturnRate ?? null)}
            placeholder="8.0" className="input-base w-full" required />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-600 mb-1">LP Split (%)</label>
          <input name="lpSplit" type="number" min="0" max="100" step="0.1"
            defaultValue={existing ? (Number(existing.lpSplit) * 100).toFixed(1) : '80'}
            className="input-base w-full" required />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-600 mb-1">Promote Hurdle IRR (%)</label>
          <input name="promoteHurdle" type="number" min="0" max="100" step="0.1"
            defaultValue={toRate(existing?.promoteHurdle ?? null)}
            placeholder="optional" className="input-base w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-600 mb-1">GP Carry above Hurdle (%)</label>
          <input name="promoteCarry" type="number" min="0" max="100" step="0.1"
            defaultValue={toRate(existing?.promoteCarry ?? null)}
            placeholder="optional" className="input-base w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-600 mb-1">Raise Close Date</label>
          <input name="raisedDate" type="date"
            defaultValue={existing?.raisedDate ? existing.raisedDate.slice(0, 10) : ''}
            className="input-base w-full" />
        </div>
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={pending}
          className="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {pending ? 'Saving…' : 'Save Waterfall'}
        </button>
        <button type="button" onClick={onDone} className="px-4 py-1.5 text-sm text-zinc-500 hover:text-zinc-700">
          Cancel
        </button>
      </div>
    </form>
  )
}

// ─── Distribution simulator ──────────────────────────────────

function DistributionSimulator({ investors, waterfall }: { investors: LpInvestorRow[]; waterfall: WaterfallRow }) {
  const [distAmount, setDistAmount] = useState('')

  const amount = parseFloat(distAmount) || 0

  const raisedDate = waterfall.raisedDate ? new Date(waterfall.raisedDate) : null
  const now = new Date()
  const holdYears = raisedDate ? (now.getTime() - raisedDate.getTime()) / (1000 * 60 * 60 * 24 * 365) : 1

  const params = {
    preferredReturnRate: Number(waterfall.preferredReturnRate),
    lpSplit: Number(waterfall.lpSplit),
    gpSplit: Number(waterfall.gpSplit),
    promoteHurdle: waterfall.promoteHurdle ? Number(waterfall.promoteHurdle) : null,
    promoteCarry: waterfall.promoteCarry ? Number(waterfall.promoteCarry) : null,
  }

  const lpInvestors = investors.map(inv => ({
    id: inv.id,
    name: inv.name,
    committedAmount: Number(inv.committedAmount),
    fundedAmount: Number(inv.fundedAmount),
    equityPct: inv.equityPct ? Number(inv.equityPct) : null,
  }))

  const result = amount > 0 ? computeWaterfallDistribution(amount, lpInvestors, params, holdYears) : null

  return (
    <div className="mt-4 border-t border-zinc-100 pt-4">
      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">Distribution Simulator</p>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm text-zinc-500">Distribute</span>
        <input
          type="number"
          min="0"
          step="1000"
          value={distAmount}
          onChange={e => setDistAmount(e.target.value)}
          placeholder="0"
          className="input-base w-36"
        />
        <span className="text-sm text-zinc-500">to all LPs</span>
      </div>

      {result && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="bg-zinc-50 rounded-lg p-3">
              <p className="text-xs text-zinc-500 mb-0.5">Preferred Return</p>
              <p className="font-semibold text-zinc-800">{fmt$(result.prefPool)}</p>
            </div>
            <div className="bg-zinc-50 rounded-lg p-3">
              <p className="text-xs text-zinc-500 mb-0.5">Return of Capital</p>
              <p className="font-semibold text-zinc-800">{fmt$(result.rocPool)}</p>
            </div>
            <div className="bg-zinc-50 rounded-lg p-3">
              <p className="text-xs text-zinc-500 mb-0.5">Equity Profit (LP / GP)</p>
              <p className="font-semibold text-zinc-800">{fmt$(result.lpCut)} / {fmt$(result.gpCut)}</p>
            </div>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-xs text-zinc-500 uppercase tracking-wide">
                <th className="text-left pb-1 font-medium">Investor</th>
                <th className="text-right pb-1 font-medium">Equity %</th>
                <th className="text-right pb-1 font-medium">Pref</th>
                <th className="text-right pb-1 font-medium">ROC</th>
                <th className="text-right pb-1 font-medium">Equity</th>
                <th className="text-right pb-1 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {result.lpDistributions.map(d => (
                <tr key={d.lpId} className="border-b border-zinc-50">
                  <td className="py-1.5 font-medium text-zinc-800">{d.name}</td>
                  <td className="py-1.5 text-right text-zinc-500">{fmtPct(d.equityPct)}</td>
                  <td className="py-1.5 text-right text-zinc-600">{fmt$(d.prefPaid)}</td>
                  <td className="py-1.5 text-right text-zinc-600">{fmt$(d.returnOfCapital)}</td>
                  <td className="py-1.5 text-right text-zinc-600">{fmt$(d.equityProfit)}</td>
                  <td className="py-1.5 text-right font-semibold text-zinc-900">{fmt$(d.total)}</td>
                </tr>
              ))}
              <tr className="text-xs font-semibold text-zinc-500 border-t border-zinc-200">
                <td className="pt-2 uppercase tracking-wide">GP Total</td>
                <td />
                <td />
                <td />
                <td />
                <td className="pt-2 text-right text-zinc-800">{fmt$(result.gpCut)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Main section ────────────────────────────────────────────

export default function MfLpSection({ dealId, investors, waterfall }: Props) {
  const [showAddInvestor, setShowAddInvestor] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showWaterfallForm, setShowWaterfallForm] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const deleteAction = deleteLpInvestor.bind(null, dealId, deletingId ?? '')
  const [, deleteFormAction, delPending] = useActionState<MfLpFormState, FormData>(deleteAction, {})

  const totalCommitted = investors.reduce((s, i) => s + Number(i.committedAmount), 0)
  const totalFunded    = investors.reduce((s, i) => s + Number(i.fundedAmount), 0)

  const equityPcts = computeEquityPcts(investors.map(i => ({
    id: i.id,
    name: i.name,
    committedAmount: Number(i.committedAmount),
    fundedAmount: Number(i.fundedAmount),
    equityPct: i.equityPct ? Number(i.equityPct) : null,
  })))

  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-900">Capital Raise &amp; LP Waterfall</h2>
        <button
          onClick={() => setShowAddInvestor(true)}
          className="text-xs text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          + Add Investor
        </button>
      </div>

      {/* Summary row */}
      {investors.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-zinc-50 rounded-lg p-3">
            <p className="text-xs text-zinc-500 mb-0.5">Investors</p>
            <p className="text-lg font-bold text-zinc-900">{investors.length}</p>
          </div>
          <div className="bg-zinc-50 rounded-lg p-3">
            <p className="text-xs text-zinc-500 mb-0.5">Committed</p>
            <p className="text-lg font-bold text-zinc-900">{fmt$(totalCommitted)}</p>
          </div>
          <div className="bg-zinc-50 rounded-lg p-3">
            <p className="text-xs text-zinc-500 mb-0.5">Funded</p>
            <p className={`text-lg font-bold ${totalFunded >= totalCommitted ? 'text-emerald-700' : 'text-amber-600'}`}>
              {fmt$(totalFunded)}
            </p>
          </div>
        </div>
      )}

      {/* Add investor form */}
      {showAddInvestor && (
        <InvestorForm dealId={dealId} existing={null} onDone={() => setShowAddInvestor(false)} />
      )}

      {/* Investor table */}
      {investors.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-xs text-zinc-500 uppercase tracking-wide">
                <th className="text-left pb-2 font-medium">Investor</th>
                <th className="text-right pb-2 font-medium">Committed</th>
                <th className="text-right pb-2 font-medium">Funded</th>
                <th className="text-right pb-2 font-medium">Outstanding</th>
                <th className="text-right pb-2 font-medium">Equity %</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {investors.map(inv => {
                const committed = Number(inv.committedAmount)
                const funded    = Number(inv.fundedAmount)
                const pct       = equityPcts.get(inv.id) ?? 0
                return (
                  <tr key={inv.id}>
                    <td className="py-2 pr-4">
                      {inv.contact ? (
                        <Link href={`/dashboard/contacts/${inv.contact.id}`} className="font-medium text-blue-600 hover:underline">
                          {inv.name}
                        </Link>
                      ) : (
                        <span className="font-medium text-zinc-800">{inv.name}</span>
                      )}
                      {inv.email && <div className="text-xs text-zinc-400">{inv.email}</div>}
                    </td>
                    <td className="py-2 text-right text-zinc-700">{fmt$(committed)}</td>
                    <td className={`py-2 text-right font-medium ${funded >= committed ? 'text-emerald-700' : 'text-zinc-700'}`}>
                      {fmt$(funded)}
                    </td>
                    <td className={`py-2 text-right ${committed - funded > 0 ? 'text-amber-600' : 'text-zinc-400'}`}>
                      {fmt$(Math.max(0, committed - funded))}
                    </td>
                    <td className="py-2 text-right text-zinc-600">{fmtPct(pct)}</td>
                    <td className="py-2 text-right">
                      {editingId === inv.id ? (
                        <InvestorForm dealId={dealId} existing={inv} onDone={() => setEditingId(null)} />
                      ) : (
                        <div className="flex justify-end gap-2">
                          <button onClick={() => setEditingId(inv.id)}
                            className="text-xs text-zinc-400 hover:text-zinc-700">Edit</button>
                          <form action={async (fd: FormData) => {
                            setDeletingId(inv.id)
                            await deleteFormAction(fd)
                            setDeletingId(null)
                          }}>
                            <button type="submit" disabled={delPending && deletingId === inv.id}
                              className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50">
                              {delPending && deletingId === inv.id ? '…' : 'Remove'}
                            </button>
                          </form>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {investors.length === 0 && !showAddInvestor && (
        <p className="text-sm text-zinc-400">No LP investors added yet.</p>
      )}

      {/* Waterfall section */}
      <div className="border-t border-zinc-100 pt-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Waterfall Parameters</p>
          <button onClick={() => setShowWaterfallForm(v => !v)}
            className="text-xs text-zinc-400 hover:text-zinc-700 transition-colors">
            {waterfall ? 'Edit' : 'Set up waterfall'}
          </button>
        </div>

        {showWaterfallForm && (
          <WaterfallForm dealId={dealId} existing={waterfall} onDone={() => setShowWaterfallForm(false)} />
        )}

        {waterfall && !showWaterfallForm && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-xs text-zinc-500">Preferred Return</p>
              <p className="font-medium text-zinc-800">{fmtPct(Number(waterfall.preferredReturnRate))}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">LP / GP Split</p>
              <p className="font-medium text-zinc-800">
                {fmtPct(Number(waterfall.lpSplit))} / {fmtPct(Number(waterfall.gpSplit))}
              </p>
            </div>
            {waterfall.promoteHurdle && (
              <div>
                <p className="text-xs text-zinc-500">Promote Hurdle</p>
                <p className="font-medium text-zinc-800">{fmtPct(Number(waterfall.promoteHurdle))} IRR</p>
              </div>
            )}
            {waterfall.promoteCarry && (
              <div>
                <p className="text-xs text-zinc-500">GP Carry Above Hurdle</p>
                <p className="font-medium text-zinc-800">{fmtPct(Number(waterfall.promoteCarry))}</p>
              </div>
            )}
          </div>
        )}

        {waterfall && investors.length > 0 && (
          <DistributionSimulator investors={investors} waterfall={waterfall} />
        )}
      </div>
    </div>
  )
}
