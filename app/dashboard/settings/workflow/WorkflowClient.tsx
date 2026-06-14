'use client'

import { useState } from 'react'

type Rule = {
  id: string
  strategy: string
  name: string
  triggerEvent: string
  offsetDays: number
  action: string
  actionConfig: Record<string, unknown>
  isActive: boolean
}

const STRATEGIES = [
  'TAX_LIEN', 'TAX_DEED', 'FORECLOSURE', 'FIX_FLIP', 'WHOLESALE', 'BUY_HOLD', 'LAND', 'MULTIFAMILY',
]

const EVENT_TYPES = [
  'REDEMPTION_DEADLINE', 'NOTICE_MAIL_BY', 'PUBLICATION_START', 'FORECLOSURE_ELIGIBLE',
  'FORECLOSURE_DEADLINE', 'AUCTION_DATE', 'DEED_ISSUED', 'OPTION_EXPIRY', 'PAYMENT_LATE',
  'INSPECTION_END', 'CLOSING_DUE', 'REHAB_DUE', 'LISTING_TARGET', 'LEASE_EXPIRY',
  'LOAN_MATURITY', 'UNIT_LEASE_END',
]

const TASK_TYPES = [
  'FOLLOW_UP', 'SEND_NOTICE', 'FILE_SUIT', 'ORDER_TITLE_SEARCH',
  'RECORD_DOCUMENT', 'PAY_SUBSEQUENT_TAXES', 'REVIEW_REDEMPTION', 'CUSTOM',
]

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH']

const STRATEGY_LABELS: Record<string, string> = {
  TAX_LIEN: 'Tax Lien', TAX_DEED: 'Tax Deed', FORECLOSURE: 'Foreclosure',
  FIX_FLIP: 'Fix & Flip', WHOLESALE: 'Wholesale', BUY_HOLD: 'Buy & Hold',
  LAND: 'Land', MULTIFAMILY: 'Multifamily',
}

type FormState = {
  strategy: string; name: string; triggerEvent: string; offsetDays: string
  taskTitle: string; taskType: string; priority: string
}

const EMPTY_FORM: FormState = {
  strategy: 'TAX_LIEN', name: '', triggerEvent: 'REDEMPTION_DEADLINE',
  offsetDays: '-7', taskTitle: '', taskType: 'FOLLOW_UP', priority: 'MEDIUM',
}

export default function WorkflowClient({ initialRules }: { initialRules: Rule[] }) {
  const [rules, setRules] = useState(initialRules)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  function setField(k: keyof FormState, v: string) {
    setForm((prev) => ({ ...prev, [k]: v }))
  }

  async function createRule() {
    if (!form.name.trim() || !form.taskTitle.trim()) return
    setSaving(true)
    const res = await fetch('/api/settings/workflow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        strategy: form.strategy,
        name: form.name.trim(),
        triggerEvent: form.triggerEvent,
        offsetDays: parseInt(form.offsetDays, 10) || 0,
        action: 'CREATE_TASK',
        actionConfig: { taskTitle: form.taskTitle.trim(), taskType: form.taskType, priority: form.priority },
      }),
    })
    if (res.ok) {
      const rule = await res.json()
      setRules((prev) => [...prev, rule])
      setForm(EMPTY_FORM)
    }
    setSaving(false)
  }

  async function toggleRule(id: string, isActive: boolean) {
    setToggling(id)
    const res = await fetch(`/api/settings/workflow/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !isActive }),
    })
    if (res.ok) setRules((prev) => prev.map((r) => r.id === id ? { ...r, isActive: !isActive } : r))
    setToggling(null)
  }

  async function deleteRule(id: string) {
    setDeleting(id)
    const res = await fetch(`/api/settings/workflow/${id}`, { method: 'DELETE' })
    if (res.ok) setRules((prev) => prev.filter((r) => r.id !== id))
    setDeleting(null)
  }

  return (
    <div className="space-y-8">
      {/* Existing rules */}
      {rules.length > 0 ? (
        <div className="space-y-2">
          {rules.map((r) => {
            const config = r.actionConfig as { taskTitle?: string; taskType?: string; priority?: string }
            return (
              <div key={r.id} className={`flex items-center gap-4 rounded-xl border px-4 py-3 bg-white ${r.isActive ? 'border-zinc-200' : 'border-zinc-100 opacity-60'}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium text-zinc-900">{r.name}</span>
                    <span className="text-xs text-zinc-400">{STRATEGY_LABELS[r.strategy] ?? r.strategy}</span>
                  </div>
                  <p className="text-xs text-zinc-500">
                    On <span className="font-medium">{r.triggerEvent}</span>
                    {r.offsetDays !== 0 && (
                      <> {r.offsetDays > 0 ? `+${r.offsetDays}` : r.offsetDays}d</>
                    )}
                    {' → '} Create task: <span className="font-medium">{config.taskTitle}</span>
                    {' '}({config.priority ?? 'MEDIUM'})
                  </p>
                </div>
                <button
                  disabled={toggling === r.id}
                  onClick={() => toggleRule(r.id, r.isActive)}
                  className={`text-xs px-2 py-1 rounded border transition-colors disabled:opacity-50 ${
                    r.isActive
                      ? 'border-emerald-200 text-emerald-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200'
                      : 'border-zinc-200 text-zinc-400 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200'
                  }`}
                >
                  {r.isActive ? 'Active' : 'Inactive'}
                </button>
                <button
                  disabled={deleting === r.id}
                  onClick={() => deleteRule(r.id)}
                  className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="text-sm text-zinc-400">No workflow rules yet. Add one below.</p>
      )}

      {/* Create form */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-900">Add Rule</h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Rule name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              placeholder="e.g. Internal review before deadline"
              className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Strategy</label>
            <select value={form.strategy} onChange={(e) => setField('strategy', e.target.value)}
              className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900">
              {STRATEGIES.map((s) => <option key={s} value={s}>{STRATEGY_LABELS[s] ?? s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Trigger event</label>
            <select value={form.triggerEvent} onChange={(e) => setField('triggerEvent', e.target.value)}
              className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900">
              {EVENT_TYPES.map((e) => <option key={e} value={e}>{e.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Offset days (negative = before)</label>
            <input
              type="number"
              value={form.offsetDays}
              onChange={(e) => setField('offsetDays', e.target.value)}
              className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Task title</label>
            <input
              type="text"
              value={form.taskTitle}
              onChange={(e) => setField('taskTitle', e.target.value)}
              placeholder="e.g. Review redemption deadline"
              className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Task type</label>
              <select value={form.taskType} onChange={(e) => setField('taskType', e.target.value)}
                className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900">
                {TASK_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Priority</label>
              <select value={form.priority} onChange={(e) => setField('priority', e.target.value)}
                className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900">
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
        </div>

        <button
          onClick={createRule}
          disabled={saving || !form.name.trim() || !form.taskTitle.trim()}
          className="px-4 py-2 rounded-lg bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Adding…' : 'Add rule'}
        </button>
      </div>
    </div>
  )
}
