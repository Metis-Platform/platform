'use client'

import { useState, useActionState } from 'react'
import { saveSection8, type Section8State } from '@/lib/actions/section8'

const HQS_RESULTS = ['PASS', 'FAIL', 'PENDING'] as const

export type Section8Data = {
  dealId: string
  hapContractNumber: string | null
  hapMonthlyAmount: string | null
  tenantPortion: string | null
  hapAnniversary: string | null
  nextHqsDate: string | null
  hqsResult: string | null
  fmrBedrooms: number | null
  rentIncreaseNoticeDays: number | null
  actualMonthlyRent: string | null
  fmrAmount: string | null  // looked up from FmrRate table by server
  housingAuthorityName: string | null
}

function fmt$(v: string | null) {
  if (!v) return '—'
  const n = parseFloat(v)
  return isNaN(n) ? '—' : `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function fmtDate(v: string | null) {
  if (!v) return '—'
  return new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function Section8Section({ data }: { data: Section8Data }) {
  const [isEditing, setIsEditing] = useState(false)
  const boundAction = saveSection8.bind(null, data.dealId)
  const [state, formAction, pending] = useActionState(boundAction, {} as Section8State)

  const hapTotal = data.hapMonthlyAmount && data.tenantPortion
    ? parseFloat(data.hapMonthlyAmount) + parseFloat(data.tenantPortion)
    : null

  const fmrAmount = data.fmrAmount ? parseFloat(data.fmrAmount) : null
  const actualRent = data.actualMonthlyRent ? parseFloat(data.actualMonthlyRent) : null
  const fmrHeadroom = fmrAmount && actualRent ? fmrAmount - actualRent : null

  const hqsColor = {
    PASS: 'bg-emerald-100 text-emerald-800',
    FAIL: 'bg-red-100 text-red-700',
    PENDING: 'bg-amber-100 text-amber-700',
  }[data.hqsResult ?? ''] ?? 'bg-zinc-100 text-zinc-500'

  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-6 mt-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-zinc-900">Section 8 / HCV</h2>
          <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">Premium</span>
        </div>
        {!isEditing && (
          <button onClick={() => setIsEditing(true)}
            className="text-xs text-zinc-500 hover:text-zinc-900 transition-colors">Edit</button>
        )}
      </div>

      {state.error && (
        <div className="mb-4 text-sm text-red-700 bg-red-50 rounded-lg px-4 py-2">{state.error}</div>
      )}

      {!isEditing && (
        <>
          {/* HAP breakdown */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4 rounded-lg border border-zinc-100 bg-zinc-50 p-4">
            <div>
              <div className="text-xs text-zinc-500 mb-0.5">HAP Contract #</div>
              <div className="text-sm font-medium font-mono text-zinc-800">{data.hapContractNumber ?? '—'}</div>
            </div>
            <div>
              <div className="text-xs text-zinc-500 mb-0.5">HAP Portion</div>
              <div className="text-base font-bold text-emerald-700">{fmt$(data.hapMonthlyAmount)}/mo</div>
            </div>
            <div>
              <div className="text-xs text-zinc-500 mb-0.5">Tenant Portion</div>
              <div className="text-base font-bold text-zinc-800">{fmt$(data.tenantPortion)}/mo</div>
            </div>
            <div>
              <div className="text-xs text-zinc-500 mb-0.5">Total Rent</div>
              <div className="text-base font-bold text-zinc-800">
                {hapTotal ? `$${hapTotal.toLocaleString()}/mo` : '—'}
              </div>
            </div>
          </div>

          {/* FMR headroom */}
          {fmrHeadroom !== null && (
            <div className={`flex items-center gap-3 text-sm rounded-lg border px-4 py-3 mb-4 ${fmrHeadroom > 0 ? 'border-emerald-100 bg-emerald-50' : 'border-zinc-100 bg-zinc-50'}`}>
              <span className="text-zinc-500">FMR ({data.fmrBedrooms}BR):</span>
              <span className="font-semibold">{fmt$(data.fmrAmount)}/mo</span>
              <span className="text-zinc-300">·</span>
              <span className="text-zinc-500">Current:</span>
              <span className="font-semibold">{fmt$(data.actualMonthlyRent)}/mo</span>
              <span className={`ml-auto text-xs font-semibold ${fmrHeadroom > 0 ? 'text-emerald-700' : 'text-zinc-400'}`}>
                {fmrHeadroom > 0 ? `+$${fmrHeadroom.toLocaleString()} raise headroom` : 'At FMR ceiling'}
              </span>
            </div>
          )}
          {!fmrAmount && data.fmrBedrooms && (
            <div className="text-xs text-zinc-400 mb-4 px-1">
              No FMR data for this county yet. FMR rates are populated via the jurisdiction data program.
            </div>
          )}

          {/* HQS & anniversary */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-zinc-500 mb-1">Next HQS Inspection</div>
              <div className="text-sm font-medium text-zinc-800">{fmtDate(data.nextHqsDate)}</div>
            </div>
            <div>
              <div className="text-xs text-zinc-500 mb-1">Last HQS Result</div>
              {data.hqsResult ? (
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${hqsColor}`}>
                  {data.hqsResult}
                </span>
              ) : <span className="text-sm text-zinc-400">—</span>}
            </div>
            <div>
              <div className="text-xs text-zinc-500 mb-1">HAP Anniversary</div>
              <div className="text-sm font-medium text-zinc-800">{fmtDate(data.hapAnniversary)}</div>
            </div>
            {data.housingAuthorityName && (
              <div>
                <div className="text-xs text-zinc-500 mb-1">Housing Authority</div>
                <div className="text-sm font-medium text-zinc-800">{data.housingAuthorityName}</div>
              </div>
            )}
            {data.rentIncreaseNoticeDays && (
              <div>
                <div className="text-xs text-zinc-500 mb-1">Rent Increase Notice</div>
                <div className="text-sm font-medium text-zinc-800">{data.rentIncreaseNoticeDays} days</div>
              </div>
            )}
          </div>
        </>
      )}

      {isEditing && (
        <form action={formAction} onSubmit={() => setIsEditing(false)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">HAP Contract #</label>
              <input name="hapContractNumber" type="text" defaultValue={data.hapContractNumber ?? ''}
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">HAP Monthly Amount ($)</label>
              <input name="hapMonthlyAmount" type="number" min={0} step={1} defaultValue={data.hapMonthlyAmount ?? ''}
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Tenant Portion ($/mo)</label>
              <input name="tenantPortion" type="number" min={0} step={1} defaultValue={data.tenantPortion ?? ''}
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">HAP Contract Anniversary</label>
              <input name="hapAnniversary" type="date" defaultValue={data.hapAnniversary ? data.hapAnniversary.split('T')[0] : ''}
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Next HQS Inspection Date</label>
              <input name="nextHqsDate" type="date" defaultValue={data.nextHqsDate ? data.nextHqsDate.split('T')[0] : ''}
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Last HQS Result</label>
              <select name="hqsResult" defaultValue={data.hqsResult ?? ''}
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400">
                <option value="">— none —</option>
                {HQS_RESULTS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Unit Bedrooms (for FMR lookup)</label>
              <input name="fmrBedrooms" type="number" min={0} max={10} step={1} defaultValue={data.fmrBedrooms ?? ''}
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                placeholder="e.g. 2" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Rent Increase Notice (days)</label>
              <input name="rentIncreaseNoticeDays" type="number" min={1} step={1} defaultValue={data.rentIncreaseNoticeDays ?? 60}
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={() => setIsEditing(false)}
              className="px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-700">Cancel</button>
            <button type="submit" disabled={pending}
              className="px-4 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {pending ? 'Saving…' : 'Save Section 8'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
