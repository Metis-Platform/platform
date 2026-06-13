'use client'

import { useState, useActionState } from 'react'
import { saveScopeOfWork, type LineItem, type ScopeOfWork, type RehabBudgetState } from '@/lib/actions/rehab-budget'

const CATEGORIES = [
  'Foundation/Structure', 'Roofing', 'Electrical', 'Plumbing', 'HVAC',
  'Windows/Doors', 'Framing/Drywall', 'Flooring', 'Kitchen', 'Bathrooms',
  'Painting/Finishes', 'Landscaping/Exterior', 'Other',
]

const STATUS_CLASSES: Record<string, string> = {
  PENDING:     'bg-zinc-100 text-zinc-600',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  COMPLETE:    'bg-emerald-100 text-emerald-700',
}
const STATUS_LABEL: Record<string, string> = {
  PENDING:     'Pending',
  IN_PROGRESS: 'In Progress',
  COMPLETE:    'Complete',
}

function newItem(): LineItem {
  return { id: Math.random().toString(36).slice(2), category: 'Other', description: '', budgeted: 0, actual: null, status: 'PENDING' }
}

type Props = {
  dealId: string
  initialScope: ScopeOfWork | null
}

const initial: RehabBudgetState = {}

export default function RehabBudgetSection({ dealId, initialScope }: Props) {
  const [items, setItems] = useState<LineItem[]>(initialScope?.items ?? [])
  const [open, setOpen] = useState(items.length > 0)

  const bound = saveScopeOfWork.bind(null, dealId)
  const [state, formAction, pending] = useActionState(bound, initial)

  const totalBudgeted = items.reduce((s, i) => s + i.budgeted, 0)
  const totalActual   = items.reduce((s, i) => s + (i.actual ?? 0), 0)
  const variance      = totalActual - totalBudgeted
  const pctComplete   = items.length > 0
    ? Math.round((items.filter(i => i.status === 'COMPLETE').length / items.length) * 100)
    : 0

  function updateItem(id: string, field: keyof LineItem, value: string | number | null) {
    setItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item))
  }

  function removeItem(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
  }

  return (
    <div className="bg-white rounded-xl border border-zinc-200">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-zinc-50 transition-colors rounded-xl"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-zinc-900">Rehab Budget</span>
          {items.length > 0 && (
            <span className="text-xs text-zinc-500">{items.length} items · {pctComplete}% complete</span>
          )}
        </div>
        <span className="text-zinc-400 text-xs">{open ? '▲ collapse' : '▼ expand'}</span>
      </button>

      {open && (
        <div className="border-t border-zinc-100">
          {/* Summary bar */}
          {items.length > 0 && (
            <div className="px-6 py-3 bg-zinc-50 flex items-center gap-6 text-sm border-b border-zinc-100">
              <div>
                <span className="text-zinc-500 text-xs">Budgeted</span>
                <div className="font-semibold text-zinc-900">${totalBudgeted.toLocaleString()}</div>
              </div>
              <div>
                <span className="text-zinc-500 text-xs">Actual</span>
                <div className="font-semibold text-zinc-900">${totalActual.toLocaleString()}</div>
              </div>
              <div>
                <span className="text-zinc-500 text-xs">Variance</span>
                <div className={`font-semibold ${variance > 0 ? 'text-red-600' : variance < 0 ? 'text-emerald-700' : 'text-zinc-900'}`}>
                  {variance >= 0 ? '+' : ''}${variance.toLocaleString()}
                </div>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <div className="w-24 h-1.5 bg-zinc-200 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pctComplete}%` }} />
                </div>
                <span className="text-xs text-zinc-500">{pctComplete}%</span>
              </div>
            </div>
          )}

          <form action={formAction}>
            <input type="hidden" name="scopeOfWork" value={JSON.stringify({ version: 1, items } as ScopeOfWork)} />

            {/* Line items */}
            {items.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 bg-zinc-50/50 text-left">
                      <th className="px-4 py-2 text-xs font-medium text-zinc-500">Category</th>
                      <th className="px-4 py-2 text-xs font-medium text-zinc-500">Description</th>
                      <th className="px-4 py-2 text-xs font-medium text-zinc-500 text-right">Budget ($)</th>
                      <th className="px-4 py-2 text-xs font-medium text-zinc-500 text-right">Actual ($)</th>
                      <th className="px-4 py-2 text-xs font-medium text-zinc-500">Status</th>
                      <th className="px-4 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {items.map(item => (
                      <tr key={item.id} className="hover:bg-zinc-50/50">
                        <td className="px-3 py-1.5">
                          <select
                            value={item.category}
                            onChange={e => updateItem(item.id, 'category', e.target.value)}
                            className="w-full border border-zinc-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-900 bg-white"
                          >
                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-1.5">
                          <input
                            type="text"
                            value={item.description}
                            onChange={e => updateItem(item.id, 'description', e.target.value)}
                            placeholder="Description"
                            className="w-full border border-zinc-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-900"
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <input
                            type="number" min="0" step="100"
                            value={item.budgeted || ''}
                            onChange={e => updateItem(item.id, 'budgeted', parseFloat(e.target.value) || 0)}
                            className="w-24 border border-zinc-200 rounded px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-zinc-900"
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <input
                            type="number" min="0" step="100"
                            value={item.actual ?? ''}
                            onChange={e => updateItem(item.id, 'actual', e.target.value ? parseFloat(e.target.value) : null)}
                            placeholder="—"
                            className={`w-24 border rounded px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-zinc-900 ${
                              item.actual != null && item.actual > item.budgeted ? 'border-red-300 bg-red-50' : 'border-zinc-200'
                            }`}
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <select
                            value={item.status}
                            onChange={e => updateItem(item.id, 'status', e.target.value)}
                            className={`border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-900 ${STATUS_CLASSES[item.status]}`}
                          >
                            {Object.keys(STATUS_LABEL).map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          <button type="button" onClick={() => removeItem(item.id)}
                            className="text-zinc-400 hover:text-red-500 text-xs transition-colors">
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {items.length === 0 && (
              <div className="px-6 py-8 text-center text-zinc-400 text-sm">
                No line items yet. Add items to track your rehab budget.
              </div>
            )}

            <div className="px-6 py-4 flex items-center gap-3 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setItems(prev => [...prev, newItem()])}
                className="px-3 py-1.5 text-sm font-medium border border-zinc-300 text-zinc-600 rounded-lg hover:bg-zinc-50 transition-colors"
              >
                + Add Line Item
              </button>
              {items.length > 0 && (
                <button
                  type="submit"
                  disabled={pending}
                  className="px-3 py-1.5 text-sm font-medium bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 disabled:opacity-50 transition-colors"
                >
                  {pending ? 'Saving…' : 'Save Budget'}
                </button>
              )}
              {state.error && <span className="text-xs text-red-600">{state.error}</span>}
              {!state.error && !pending && items.length > 0 && <span className="text-xs text-zinc-400">Changes auto-update totals in detail panel</span>}
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
