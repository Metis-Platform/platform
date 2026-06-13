'use client'

import { useState, useActionState } from 'react'
import { saveBusinessPlan, type BusinessPlanState } from '@/lib/actions/multifamily-businessplan'
import { computeBusinessPlanMetrics, type BusinessPlan } from '@/lib/multifamily-schemas'

function fmt$(v: number) {
  return `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

function fmtPct(v: number) {
  return `${(v * 100).toFixed(1)}%`
}

export default function BusinessPlanSection({
  dealId,
  initialPlan,
  unitCount,
  purchasePrice,
  currentNoi,
}: {
  dealId: string
  initialPlan: BusinessPlan | null
  unitCount: number | null
  purchasePrice: number | null
  currentNoi: number | null
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [plan, setPlan] = useState<Partial<BusinessPlan>>(initialPlan ?? {
    renovationLiftPerUnit: 0,
    unitsRenovated: 0,
    targetUnitsToRenovate: unitCount ?? 1,
    stabilizedNoiTarget: 0,
    notes: null,
  })

  const boundAction = saveBusinessPlan.bind(null, dealId)
  const [state, formAction, pending] = useActionState(boundAction, {} as BusinessPlanState)

  const validPlan = initialPlan
  const metrics = validPlan ? computeBusinessPlanMetrics(validPlan, purchasePrice, currentNoi) : null

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    formAction(fd)
    setIsEditing(false)
  }

  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-6 mt-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-zinc-900">Value-Add Plan</h2>
        {!isEditing && (
          <button onClick={() => setIsEditing(true)}
            className="text-xs text-zinc-500 hover:text-zinc-900 transition-colors">
            {validPlan ? 'Edit' : 'Set Up Plan'}
          </button>
        )}
      </div>

      {state.error && (
        <div className="mb-4 text-sm text-red-700 bg-red-50 rounded-lg px-4 py-2">{state.error}</div>
      )}

      {/* Metrics display */}
      {validPlan && metrics && !isEditing && (
        <>
          {/* Progress bar */}
          <div className="mb-5">
            <div className="flex justify-between text-xs text-zinc-500 mb-1.5">
              <span>{validPlan.unitsRenovated} of {validPlan.targetUnitsToRenovate} units renovated</span>
              <span className="font-medium text-zinc-700">{fmtPct(metrics.progressPct)}</span>
            </div>
            <div className="w-full bg-zinc-100 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all"
                style={{ width: `${Math.min(metrics.progressPct * 100, 100)}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4 rounded-lg border border-zinc-100 bg-zinc-50 p-4">
            <div>
              <div className="text-xs text-zinc-500 mb-0.5">Rent Lift/Unit</div>
              <div className="text-base font-bold text-zinc-800">{fmt$(validPlan.renovationLiftPerUnit)}/mo</div>
            </div>
            <div>
              <div className="text-xs text-zinc-500 mb-0.5">Achieved Lift</div>
              <div className="text-base font-bold text-emerald-700">{fmt$(metrics.achievedLift)}/yr</div>
            </div>
            <div>
              <div className="text-xs text-zinc-500 mb-0.5">Stabilized NOI Target</div>
              <div className="text-base font-bold text-zinc-800">{fmt$(validPlan.stabilizedNoiTarget)}/yr</div>
            </div>
            <div>
              <div className="text-xs text-zinc-500 mb-0.5">Stabilized Cap Rate</div>
              <div className={`text-base font-bold ${metrics.stabilizedCapRate != null && metrics.stabilizedCapRate >= 0.07 ? 'text-emerald-700' : 'text-amber-600'}`}>
                {metrics.stabilizedCapRate != null ? fmtPct(metrics.stabilizedCapRate) : '—'}
              </div>
            </div>
          </div>

          {/* In-place vs stabilized comparison */}
          {metrics.inPlaceCapRate != null && metrics.stabilizedCapRate != null && (
            <div className="flex items-center gap-3 text-sm rounded-lg border border-zinc-100 bg-zinc-50 px-4 py-3">
              <span className="text-zinc-500">In-place cap rate:</span>
              <span className="font-semibold text-zinc-800">{fmtPct(metrics.inPlaceCapRate)}</span>
              <span className="text-zinc-300">→</span>
              <span className="text-zinc-500">Stabilized:</span>
              <span className="font-semibold text-emerald-700">{fmtPct(metrics.stabilizedCapRate)}</span>
              <span className={`ml-auto text-xs font-medium ${metrics.stabilizedCapRate > metrics.inPlaceCapRate ? 'text-emerald-600' : 'text-zinc-400'}`}>
                +{fmtPct(metrics.stabilizedCapRate - metrics.inPlaceCapRate)} expansion
              </span>
            </div>
          )}

          {validPlan.notes && (
            <p className="mt-3 text-sm text-zinc-500 whitespace-pre-line">{validPlan.notes}</p>
          )}
        </>
      )}

      {/* Edit form */}
      {isEditing && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Renovation Lift / Unit ($/mo)</label>
              <input type="number" name="renovationLiftPerUnit" min={0} step={1}
                defaultValue={plan.renovationLiftPerUnit ?? 0}
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Units Renovated (so far)</label>
              <input type="number" name="unitsRenovated" min={0} step={1}
                defaultValue={plan.unitsRenovated ?? 0}
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Total Units to Renovate</label>
              <input type="number" name="targetUnitsToRenovate" min={1} step={1}
                defaultValue={plan.targetUnitsToRenovate ?? unitCount ?? 1}
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Stabilized NOI Target ($/yr)</label>
              <input type="number" name="stabilizedNoiTarget" min={0} step={100}
                defaultValue={plan.stabilizedNoiTarget ?? 0}
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Notes</label>
            <textarea name="notes" rows={2} defaultValue={plan.notes ?? ''}
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
          </div>
          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={() => { setPlan(initialPlan ?? {}); setIsEditing(false) }}
              className="px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-700">Cancel</button>
            <button type="submit" disabled={pending}
              className="px-4 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {pending ? 'Saving…' : 'Save Plan'}
            </button>
          </div>
        </form>
      )}

      {!validPlan && !isEditing && (
        <div className="text-center py-8">
          <p className="text-sm text-zinc-400 mb-3">No value-add plan configured yet.</p>
          <button onClick={() => setIsEditing(true)}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
            Set Up Plan
          </button>
        </div>
      )}
    </div>
  )
}
