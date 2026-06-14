'use client'

import { useState } from 'react'
import type { ChecklistItem } from '@/lib/checklists/types'

type Props = {
  strategy: string
  name: string
  isActive: boolean
  items: ChecklistItem[]
}

export default function TemplateEditor({ strategy, name: initialName, isActive: initialActive, items: initialItems }: Props) {
  const [name, setName] = useState(initialName)
  const [isActive, setIsActive] = useState(initialActive)
  const [items, setItems] = useState<ChecklistItem[]>(initialItems)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function updateItem(index: number, field: keyof ChecklistItem, value: unknown) {
    setItems((prev) => prev.map((item, i) => i === index ? { ...item, [field]: value } : item))
    setSaved(false)
  }

  function moveItem(index: number, direction: -1 | 1) {
    const next = index + direction
    if (next < 0 || next >= items.length) return
    const reordered = [...items]
    ;[reordered[index], reordered[next]] = [reordered[next], reordered[index]]
    setItems(reordered)
    setSaved(false)
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
    setSaved(false)
  }

  function addItem() {
    const newItem: ChecklistItem = {
      key: `custom-${Date.now()}`,
      title: 'New checklist item',
      taskType: 'CUSTOM',
      defaultPriority: 'MEDIUM',
    }
    setItems((prev) => [...prev, newItem])
    setSaved(false)
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/templates/${strategy}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, isActive, items }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ? JSON.stringify(data.error) : 'Save failed')
      } else {
        setSaved(true)
      }
    } catch {
      setError('Network error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Template meta */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-900">Template Settings</h2>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="block text-xs text-zinc-500 mb-1">Template name</label>
            <input
              value={name}
              onChange={(e) => { setName(e.target.value); setSaved(false) }}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => { setIsActive(e.target.checked); setSaved(false) }}
              className="h-4 w-4 rounded border-zinc-300 text-zinc-900"
            />
            <span className="text-sm text-zinc-700">Active</span>
          </label>
        </div>
      </div>

      {/* Items */}
      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
          <h2 className="text-sm font-semibold text-zinc-900">Items ({items.length})</h2>
          <button
            onClick={addItem}
            className="text-xs px-3 py-1.5 rounded-lg border border-zinc-300 text-zinc-600 hover:bg-zinc-50 transition-colors"
          >
            + Add item
          </button>
        </div>
        <div className="divide-y divide-zinc-100">
          {items.map((item, i) => (
            <div key={item.key} className="px-5 py-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex flex-col gap-1 mt-0.5">
                  <button
                    onClick={() => moveItem(i, -1)}
                    disabled={i === 0}
                    className="text-zinc-300 hover:text-zinc-600 disabled:opacity-20 text-xs leading-none"
                    title="Move up"
                  >▲</button>
                  <button
                    onClick={() => moveItem(i, 1)}
                    disabled={i === items.length - 1}
                    className="text-zinc-300 hover:text-zinc-600 disabled:opacity-20 text-xs leading-none"
                    title="Move down"
                  >▼</button>
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <input
                    value={item.title}
                    onChange={(e) => updateItem(i, 'title', e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                    placeholder="Item title"
                  />
                  <textarea
                    value={item.description ?? ''}
                    onChange={(e) => updateItem(i, 'description', e.target.value || undefined)}
                    rows={2}
                    className="w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-900 resize-none"
                    placeholder="Description (optional)"
                  />
                  <div className="flex gap-2">
                    <select
                      value={item.taskType}
                      onChange={(e) => updateItem(i, 'taskType', e.target.value)}
                      className="rounded-lg border border-zinc-200 px-2 py-1 text-xs text-zinc-700 focus:outline-none"
                    >
                      {['CUSTOM', 'FOLLOW_UP', 'DOCUMENT_REVIEW', 'PAYMENT', 'INSPECTION', 'LEGAL'].map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    <select
                      value={item.defaultPriority}
                      onChange={(e) => updateItem(i, 'defaultPriority', e.target.value)}
                      className="rounded-lg border border-zinc-200 px-2 py-1 text-xs text-zinc-700 focus:outline-none"
                    >
                      {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                    {item.dueAnchor && (
                      <span className="text-xs text-zinc-400 self-center">
                        {item.dueOffsetDays !== undefined ? `${item.dueOffsetDays > 0 ? '+' : ''}${item.dueOffsetDays}d from ${item.dueAnchor}` : item.dueAnchor}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => removeItem(i)}
                  className="flex-shrink-0 text-red-400 hover:text-red-600 text-sm mt-0.5"
                  title="Remove"
                >×</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Save bar */}
      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="px-5 py-2 rounded-lg bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : 'Save as system default'}
        </button>
        {saved && <span className="text-sm text-emerald-600">Saved ✓</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </div>
  )
}
