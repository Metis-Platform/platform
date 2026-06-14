'use client'

import { useState } from 'react'

const CREATABLE_STRATEGIES = [
  'TAX_LIEN', 'TAX_DEED', 'FORECLOSURE', 'FIX_FLIP', 'WHOLESALE', 'BUY_HOLD', 'LAND', 'MULTIFAMILY',
]

type Module = { strategy: string; tier: string; createdAt: string }
type User = { id: string; name: string | null; email: string; role: string; createdAt: string }

type Props = {
  tenantId: string
  tenantEmail: string
  trialEndsAt: string | null
  adminNotes: string | null
  modules: Module[]
  users: User[]
}

export default function TenantDetailClient({
  tenantId,
  tenantEmail,
  trialEndsAt: initialTrial,
  adminNotes: initialNotes,
  modules: initialModules,
  users,
}: Props) {
  const [modules, setModules] = useState(initialModules)
  const [changingModule, setChangingModule] = useState<string | null>(null)
  const [trialEndsAt, setTrialEndsAt] = useState(initialTrial)
  const [extendingTrial, setExtendingTrial] = useState(false)
  const [notes, setNotes] = useState(initialNotes ?? '')
  const [newNote, setNewNote] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)

  async function setModuleTier(strategy: string, tier: string | null) {
    const key = strategy
    setChangingModule(key)

    if (tier === null) {
      const res = await fetch(`/api/admin/tenants/${tenantId}/modules`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategy }),
      })
      if (res.ok) setModules((prev) => prev.filter((m) => m.strategy !== strategy))
    } else {
      const res = await fetch(`/api/admin/tenants/${tenantId}/modules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategy, tier }),
      })
      if (res.ok) {
        setModules((prev) => {
          const existing = prev.find((m) => m.strategy === strategy)
          if (existing) return prev.map((m) => m.strategy === strategy ? { ...m, tier } : m)
          return [...prev, { strategy, tier, createdAt: new Date().toISOString() }]
        })
      }
    }
    setChangingModule(null)
  }

  async function extendTrial(days: number) {
    setExtendingTrial(true)
    const res = await fetch(`/api/admin/tenants/${tenantId}/trial`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ days }),
    })
    if (res.ok) {
      const data = await res.json()
      setTrialEndsAt(data.trialEndsAt)
    }
    setExtendingTrial(false)
  }

  async function addNote() {
    if (!newNote.trim()) return
    setSavingNotes(true)
    const timestamp = new Date().toLocaleString()
    const entry = `[${timestamp}] ${newNote.trim()}`
    const updated = notes ? `${entry}\n\n${notes}` : entry
    const res = await fetch(`/api/admin/tenants/${tenantId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminNotes: updated }),
    })
    if (res.ok) {
      setNotes(updated)
      setNewNote('')
    }
    setSavingNotes(false)
  }

  return (
    <div className="space-y-8">
      {/* Quick actions */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">
            Trial ends: {trialEndsAt ? new Date(trialEndsAt).toLocaleDateString() : 'not set'}
          </span>
          {[7, 14, 30].map((days) => (
            <button
              key={days}
              disabled={extendingTrial}
              onClick={() => extendTrial(days)}
              className="text-xs px-2 py-1 rounded border border-zinc-200 text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 transition-colors"
            >
              +{days}d
            </button>
          ))}
        </div>
        <a
          href={`mailto:${tenantEmail}`}
          className="text-xs px-3 py-1.5 rounded-lg border border-zinc-300 text-zinc-600 hover:bg-zinc-50 transition-colors"
        >
          Send email
        </a>
      </div>

      {/* Module access */}
      <section>
        <h2 className="text-sm font-semibold text-zinc-900 mb-3">Module Access</h2>
        <div className="flex flex-wrap gap-2">
          {CREATABLE_STRATEGIES.map((strategy) => {
            const mod = modules.find((m) => m.strategy === strategy)
            const busy = changingModule === strategy
            const label = strategy.replace(/_/g, ' ')

            return (
              <div key={strategy} className="flex items-center gap-1.5 border border-zinc-200 rounded-lg px-2 py-1.5 bg-white">
                <span className="text-xs text-zinc-600 w-24 truncate">{label}</span>
                {mod ? (
                  <>
                    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                      mod.tier === 'PREMIUM' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {mod.tier === 'PREMIUM' ? 'PRE' : 'STD'}
                    </span>
                    <span className="text-xs text-zinc-400">
                      {new Date(mod.createdAt).toLocaleDateString()}
                    </span>
                    {mod.tier === 'STANDARD' ? (
                      <button disabled={busy} onClick={() => setModuleTier(strategy, 'PREMIUM')}
                        className="text-xs text-amber-600 hover:underline disabled:opacity-50" title="Upgrade to Premium">↑PRE</button>
                    ) : (
                      <button disabled={busy} onClick={() => setModuleTier(strategy, 'STANDARD')}
                        className="text-xs text-zinc-500 hover:underline disabled:opacity-50" title="Downgrade to Standard">↓STD</button>
                    )}
                    <button disabled={busy} onClick={() => setModuleTier(strategy, null)}
                      className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50 ml-1" title="Revoke">×</button>
                  </>
                ) : (
                  <>
                    <button disabled={busy} onClick={() => setModuleTier(strategy, 'STANDARD')}
                      className="text-xs px-1.5 py-0.5 rounded border border-zinc-200 text-zinc-500 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 disabled:opacity-50 transition-colors">+STD</button>
                    <button disabled={busy} onClick={() => setModuleTier(strategy, 'PREMIUM')}
                      className="text-xs px-1.5 py-0.5 rounded border border-zinc-200 text-zinc-500 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200 disabled:opacity-50 transition-colors">+PRE</button>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* Users */}
      <section>
        <h2 className="text-sm font-semibold text-zinc-900 mb-3">Users ({users.length})</h2>
        {users.length === 0 ? (
          <p className="text-sm text-zinc-400">No users yet.</p>
        ) : (
          <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-200">
                <tr>
                  <th className="text-left px-4 py-2 text-xs font-medium text-zinc-500">Name</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-zinc-500">Email</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-zinc-500">Role</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-zinc-500">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-2 text-zinc-900">{u.name ?? '—'}</td>
                    <td className="px-4 py-2 text-zinc-500">{u.email}</td>
                    <td className="px-4 py-2 text-zinc-500 capitalize">{u.role.toLowerCase()}</td>
                    <td className="px-4 py-2 text-zinc-400 text-xs">{new Date(u.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Admin notes */}
      <section>
        <h2 className="text-sm font-semibold text-zinc-900 mb-3">Admin Notes</h2>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-3">
          <div className="flex gap-2">
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Add a note about this tenant…"
              rows={2}
              className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 resize-none"
            />
            <button
              onClick={addNote}
              disabled={savingNotes || !newNote.trim()}
              className="self-end px-4 py-2 rounded-lg bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-700 disabled:opacity-50 transition-colors"
            >
              {savingNotes ? 'Saving…' : 'Add note'}
            </button>
          </div>
          {notes ? (
            <pre className="text-xs text-zinc-600 whitespace-pre-wrap font-sans leading-relaxed max-h-64 overflow-y-auto">
              {notes}
            </pre>
          ) : (
            <p className="text-xs text-zinc-400">No notes yet.</p>
          )}
        </div>
      </section>
    </div>
  )
}
