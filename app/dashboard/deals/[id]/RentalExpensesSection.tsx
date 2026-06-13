'use client'

import { useActionState } from 'react'
import {
  saveOperatingExpenses,
  EXPENSE_CATEGORIES,
  type RentalExpenses,
  type RentalExpenseState,
} from '@/lib/actions/rental-expenses'

type Props = {
  dealId: string
  initialExpenses: RentalExpenses | null
  monthlyRent: number | null
}

const initial: RentalExpenseState = {}

export default function RentalExpensesSection({ dealId, initialExpenses, monthlyRent }: Props) {
  const bound = saveOperatingExpenses.bind(null, dealId)
  const [state, formAction, pending] = useActionState(bound, initial)

  const existingMap = Object.fromEntries(
    (initialExpenses?.items ?? []).map(e => [e.category, e.monthlyAmount])
  )

  const totalMonthly = Object.values(existingMap).reduce((s: number, v) => s + (v ?? 0), 0)
  const annualExpenses = totalMonthly * 12
  const annualRent = monthlyRent ? monthlyRent * 12 : null
  const noi = annualRent != null ? annualRent - annualExpenses : null

  const fmt$ = (n: number) => `$${Math.round(n).toLocaleString()}`

  return (
    <div className="bg-white rounded-xl border border-zinc-200">
      <div className="px-6 py-4 flex items-center justify-between">
        <span className="text-sm font-semibold text-zinc-900">Operating Expenses</span>
        {totalMonthly > 0 && (
          <span className="text-xs text-zinc-500">{fmt$(totalMonthly)}/mo · {fmt$(annualExpenses)}/yr</span>
        )}
      </div>

      <div className="border-t border-zinc-100">
        <form action={formAction}>
          <div className="divide-y divide-zinc-50">
            {EXPENSE_CATEGORIES.map(c => (
              <div key={c.category} className="px-6 py-2.5 flex items-center gap-4">
                <label htmlFor={`expense_${c.category}`} className="flex-1 text-sm text-zinc-700">
                  {c.label}
                </label>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-zinc-400">$</span>
                  <input
                    id={`expense_${c.category}`}
                    type="number"
                    name={`expense_${c.category}`}
                    min="0"
                    step="1"
                    defaultValue={existingMap[c.category] || ''}
                    placeholder="0"
                    className="w-24 border border-zinc-200 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-zinc-900"
                  />
                  <span className="text-xs text-zinc-400 w-6">/mo</span>
                </div>
              </div>
            ))}
          </div>

          {/* NOI summary */}
          {(totalMonthly > 0 || annualRent != null) && (
            <div className="px-6 py-4 bg-zinc-50 border-t border-zinc-100 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              {annualRent != null && (
                <div>
                  <div className="text-xs text-zinc-500 mb-0.5">Gross Rent/yr</div>
                  <div className="font-semibold text-zinc-900">{fmt$(annualRent)}</div>
                </div>
              )}
              <div>
                <div className="text-xs text-zinc-500 mb-0.5">Expenses/yr</div>
                <div className="font-semibold text-zinc-900">{fmt$(annualExpenses)}</div>
              </div>
              {noi != null && (
                <div>
                  <div className="text-xs text-zinc-500 mb-0.5">NOI</div>
                  <div className={`font-bold ${noi >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{fmt$(noi)}/yr</div>
                </div>
              )}
            </div>
          )}

          <div className="px-6 py-3 border-t border-zinc-100 flex items-center gap-3">
            <button
              type="submit"
              disabled={pending}
              className="px-3 py-1.5 text-sm font-medium bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 disabled:opacity-50 transition-colors"
            >
              {pending ? 'Saving…' : 'Save Expenses'}
            </button>
            {state.error && <span className="text-xs text-red-600">{state.error}</span>}
          </div>
        </form>
      </div>
    </div>
  )
}
