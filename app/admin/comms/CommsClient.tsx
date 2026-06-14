'use client'

import { useState } from 'react'

type Tenant = { id: string; name: string; slug: string }
type ActiveAnnouncement = { id: string; message: string; severity: string; endsAt: string }

type Props = {
  tenants: Tenant[]
  activeAnnouncements: ActiveAnnouncement[]
}

export default function CommsClient({ tenants, activeAnnouncements: initial }: Props) {
  // Per-tenant email
  const [selectedTenant, setSelectedTenant] = useState('')
  const [tenantSubject, setTenantSubject] = useState('')
  const [tenantBody, setTenantBody] = useState('')
  const [sendingTenant, setSendingTenant] = useState(false)
  const [tenantResult, setTenantResult] = useState<string | null>(null)

  // Broadcast email
  const [broadSubject, setBroadSubject] = useState('')
  const [broadBody, setBroadBody] = useState('')
  const [sendingBroadcast, setSendingBroadcast] = useState(false)
  const [broadResult, setBroadResult] = useState<string | null>(null)

  // Announcement banner
  const [announcements, setAnnouncements] = useState(initial)
  const [annMessage, setAnnMessage] = useState('')
  const [annSeverity, setAnnSeverity] = useState<'INFO' | 'WARNING'>('INFO')
  const [annEndsAt, setAnnEndsAt] = useState('')
  const [savingAnn, setSavingAnn] = useState(false)
  const [annResult, setAnnResult] = useState<string | null>(null)

  async function sendTenantEmail() {
    if (!selectedTenant || !tenantSubject || !tenantBody) return
    setSendingTenant(true)
    setTenantResult(null)
    try {
      const res = await fetch('/api/admin/comms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: selectedTenant, subject: tenantSubject, body: tenantBody }),
      })
      const data = await res.json()
      setTenantResult(res.ok ? `Sent to ${data.sent} recipient${data.sent === 1 ? '' : 's'}` : `Error: ${data.error}`)
      if (res.ok) { setTenantSubject(''); setTenantBody('') }
    } finally { setSendingTenant(false) }
  }

  async function sendBroadcast() {
    if (!broadSubject || !broadBody) return
    if (!confirm(`Send broadcast to all ${tenants.length} tenants? This is rate-limited to 1 per 24h.`)) return
    setSendingBroadcast(true)
    setBroadResult(null)
    try {
      const res = await fetch('/api/admin/comms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ broadcast: true, subject: broadSubject, body: broadBody }),
      })
      const data = await res.json()
      setBroadResult(res.ok ? `Sent to ${data.sent} tenants (${data.skipped} failed)` : `Error: ${data.error}`)
      if (res.ok) { setBroadSubject(''); setBroadBody('') }
    } finally { setSendingBroadcast(false) }
  }

  async function createAnnouncement() {
    if (!annMessage || !annEndsAt) return
    setSavingAnn(true)
    setAnnResult(null)
    try {
      const endsAt = new Date(annEndsAt).toISOString()
      const res = await fetch('/api/admin/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: annMessage, severity: annSeverity, endsAt }),
      })
      const data = await res.json()
      if (res.ok) {
        setAnnouncements(prev => [{ id: data.id, message: data.message, severity: data.severity, endsAt: data.endsAt }, ...prev])
        setAnnMessage('')
        setAnnEndsAt('')
        setAnnResult('Announcement published')
      } else {
        setAnnResult(`Error: ${data.error}`)
      }
    } finally { setSavingAnn(false) }
  }

  async function deleteAnnouncement(id: string) {
    await fetch('/api/admin/announcements', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setAnnouncements(prev => prev.filter(a => a.id !== id))
  }

  return (
    <div className="space-y-8">
      {/* Per-tenant email */}
      <section>
        <h2 className="text-sm font-semibold text-zinc-900 mb-3">Direct Email — Single Tenant</h2>
        <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-4">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Tenant</label>
            <select
              value={selectedTenant}
              onChange={e => setSelectedTenant(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
            >
              <option value="">Select a tenant…</option>
              {tenants.map(t => (
                <option key={t.id} value={t.id}>{t.name} ({t.slug})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Subject</label>
            <input
              value={tenantSubject}
              onChange={e => setTenantSubject(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
              placeholder="Re: Your Metis account"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Body</label>
            <textarea
              value={tenantBody}
              onChange={e => setTenantBody(e.target.value)}
              rows={5}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 resize-none"
              placeholder="Hi, I wanted to follow up about…"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={sendTenantEmail}
              disabled={sendingTenant || !selectedTenant || !tenantSubject || !tenantBody}
              className="px-4 py-2 rounded-lg bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-700 disabled:opacity-50 transition-colors"
            >
              {sendingTenant ? 'Sending…' : 'Send email'}
            </button>
            {tenantResult && <span className={`text-sm ${tenantResult.startsWith('Error') ? 'text-red-600' : 'text-emerald-600'}`}>{tenantResult}</span>}
          </div>
        </div>
      </section>

      {/* Broadcast email */}
      <section>
        <h2 className="text-sm font-semibold text-zinc-900 mb-1">Broadcast — All Tenants</h2>
        <p className="text-xs text-zinc-400 mb-3">Rate-limited to 1 per 24 hours. Sends to one owner per tenant ({tenants.length} tenants).</p>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 space-y-4">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Subject</label>
            <input
              value={broadSubject}
              onChange={e => setBroadSubject(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="Important update from Metis"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Body</label>
            <textarea
              value={broadBody}
              onChange={e => setBroadBody(e.target.value)}
              rows={5}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
              placeholder="We're announcing…"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={sendBroadcast}
              disabled={sendingBroadcast || !broadSubject || !broadBody}
              className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors"
            >
              {sendingBroadcast ? 'Sending…' : `Broadcast to ${tenants.length} tenants`}
            </button>
            {broadResult && <span className={`text-sm ${broadResult.startsWith('Error') ? 'text-red-600' : 'text-emerald-600'}`}>{broadResult}</span>}
          </div>
        </div>
      </section>

      {/* In-app announcement banner */}
      <section>
        <h2 className="text-sm font-semibold text-zinc-900 mb-3">In-App Announcement Banner</h2>
        <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-4">
          {announcements.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-zinc-500">Active announcements</p>
              {announcements.map(a => (
                <div key={a.id} className={`flex items-start justify-between gap-3 rounded-lg border px-4 py-3 ${a.severity === 'WARNING' ? 'border-amber-200 bg-amber-50' : 'border-blue-200 bg-blue-50'}`}>
                  <div>
                    <p className="text-sm text-zinc-900">{a.message}</p>
                    <p className="text-xs text-zinc-400 mt-0.5">Expires {new Date(a.endsAt).toLocaleDateString()}</p>
                  </div>
                  <button onClick={() => deleteAnnouncement(a.id)} className="text-zinc-400 hover:text-red-600 text-sm flex-shrink-0">×</button>
                </div>
              ))}
            </div>
          )}
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs text-zinc-500 mb-1">Message</label>
                <input
                  value={annMessage}
                  onChange={e => setAnnMessage(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  placeholder="Scheduled maintenance tonight 11pm–2am ET."
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Severity</label>
                <select
                  value={annSeverity}
                  onChange={e => setAnnSeverity(e.target.value as 'INFO' | 'WARNING')}
                  className="rounded-lg border border-zinc-300 px-2 py-2 text-sm focus:outline-none"
                >
                  <option value="INFO">Info</option>
                  <option value="WARNING">Warning</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Expires</label>
                <input
                  type="datetime-local"
                  value={annEndsAt}
                  onChange={e => setAnnEndsAt(e.target.value)}
                  className="rounded-lg border border-zinc-300 px-2 py-2 text-sm focus:outline-none"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={createAnnouncement}
                disabled={savingAnn || !annMessage || !annEndsAt}
                className="px-4 py-2 rounded-lg bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-700 disabled:opacity-50 transition-colors"
              >
                {savingAnn ? 'Publishing…' : 'Publish banner'}
              </button>
              {annResult && <span className={`text-sm ${annResult.startsWith('Error') ? 'text-red-600' : 'text-emerald-600'}`}>{annResult}</span>}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
