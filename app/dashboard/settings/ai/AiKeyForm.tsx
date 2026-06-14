'use client'

import { useState } from 'react'

export default function AiKeyForm({ hasKey }: { hasKey: boolean }) {
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSave() {
    if (!apiKey.trim()) return
    setSaving(true)
    setStatus('idle')
    try {
      const res = await fetch('/api/settings/ai-key', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? 'Failed to save')
      }
      setApiKey('')
      setStatus('success')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save')
      setStatus('error')
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove() {
    if (!confirm('Remove your Anthropic API key? AI features will stop working until you add a new one.')) return
    setSaving(true)
    setStatus('idle')
    try {
      const res = await fetch('/api/settings/ai-key', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: null }),
      })
      if (!res.ok) throw new Error('Failed to remove key')
      setStatus('success')
    } catch {
      setStatus('error')
      setErrorMsg('Failed to remove key')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {hasKey && status !== 'success' && (
        <div className="flex items-center gap-2 text-sm text-zinc-600">
          <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
          API key is configured
          <button
            onClick={handleRemove}
            disabled={saving}
            className="ml-auto text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
          >
            Remove
          </button>
        </div>
      )}

      {status === 'success' && (
        <p className="text-sm text-green-600">Saved successfully.</p>
      )}

      <div className="flex gap-2">
        <input
          type="password"
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          placeholder={hasKey ? 'Enter new key to replace current' : 'sk-ant-...'}
          disabled={saving}
          className="flex-1 text-sm border border-zinc-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 font-mono"
        />
        <button
          onClick={handleSave}
          disabled={saving || !apiKey.trim()}
          className="px-4 py-2 text-sm font-medium bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      {status === 'error' && (
        <p className="text-xs text-red-600">{errorMsg}</p>
      )}
    </div>
  )
}
