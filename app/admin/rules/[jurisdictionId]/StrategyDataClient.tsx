'use client'

import { useState } from 'react'
import { STRATEGY_FIELDS, STRATEGY_LABELS, type FieldDef } from '@/lib/jurisdiction-strategy-fields'

type StrategyDataRow = { strategy: string; data: Record<string, unknown>; updatedAt: string }

type Props = {
  jurisdictionId: string
  initialData: StrategyDataRow[]
}

export default function StrategyDataClient({ jurisdictionId, initialData }: Props) {
  const [dataMap, setDataMap] = useState<Record<string, Record<string, unknown>>>(
    Object.fromEntries(initialData.map((r) => [r.strategy, r.data]))
  )
  const [saving, setSaving] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<Record<string, string>>({})
  const [activeStrategy, setActiveStrategy] = useState<string>(Object.keys(STRATEGY_FIELDS)[0])

  function getValue(strategy: string, field: FieldDef): string | boolean {
    const val = dataMap[strategy]?.[field.key]
    if (field.type === 'boolean') return val === true
    return val != null ? String(val) : ''
  }

  function setValue(strategy: string, key: string, type: FieldDef['type'], raw: string | boolean) {
    setDataMap((prev) => {
      const current = prev[strategy] ?? {}
      let coerced: unknown = raw
      if (type === 'number') coerced = raw === '' ? null : Number(raw)
      if (type === 'boolean') coerced = raw as boolean
      return { ...prev, [strategy]: { ...current, [key]: coerced } }
    })
  }

  async function save(strategy: string) {
    setSaving(strategy)
    const res = await fetch(`/api/admin/jurisdictions/${jurisdictionId}/strategy-data`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ strategy, data: dataMap[strategy] ?? {} }),
    })
    if (res.ok) setSavedAt((prev) => ({ ...prev, [strategy]: new Date().toLocaleTimeString() }))
    setSaving(null)
  }

  const strategies = Object.keys(STRATEGY_FIELDS)

  return (
    <div>
      {/* Strategy tabs */}
      <div className="flex gap-1 mb-4 flex-wrap">
        {strategies.map((s) => (
          <button
            key={s}
            onClick={() => setActiveStrategy(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeStrategy === s
                ? 'bg-zinc-900 text-white'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            {STRATEGY_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Fields for active strategy */}
      {strategies.map((strategy) => {
        if (strategy !== activeStrategy) return null
        const fields = STRATEGY_FIELDS[strategy]
        return (
          <div key={strategy} className="space-y-4">
            {fields.map((field) => {
              const val = getValue(strategy, field)
              return (
                <div key={field.key}>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    {field.label}
                  </label>
                  {field.type === 'boolean' ? (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={val as boolean}
                        onChange={(e) => setValue(strategy, field.key, 'boolean', e.target.checked)}
                        className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                      />
                      <span className="text-sm text-zinc-600">{val ? 'Yes' : 'No'}</span>
                    </label>
                  ) : field.type === 'textarea' ? (
                    <textarea
                      value={val as string}
                      onChange={(e) => setValue(strategy, field.key, 'textarea', e.target.value)}
                      rows={3}
                      placeholder={field.placeholder}
                      className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 resize-none"
                    />
                  ) : (
                    <input
                      type={field.type === 'number' ? 'number' : 'text'}
                      value={val as string}
                      onChange={(e) => setValue(strategy, field.key, field.type, e.target.value)}
                      placeholder={field.placeholder}
                      className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                    />
                  )}
                </div>
              )
            })}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => save(strategy)}
                disabled={saving === strategy}
                className="px-4 py-2 rounded-lg bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-700 disabled:opacity-50 transition-colors"
              >
                {saving === strategy ? 'Saving…' : 'Save'}
              </button>
              {savedAt[strategy] && (
                <span className="text-xs text-emerald-600">Saved at {savedAt[strategy]}</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
