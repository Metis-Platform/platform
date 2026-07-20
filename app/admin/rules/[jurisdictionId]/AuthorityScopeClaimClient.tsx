'use client'

import { useState } from 'react'

type Source = { id: string; url: string; retrievedAt: string }
type Scope = 'COUNTY_WIDE' | 'UNINCORPORATED_COUNTY'

type Props = { jurisdictionId: string; sources: Source[] }

export function authorityScopePayload(sourceUrlId: string, scope: Scope, citation: string) {
  return { sourceUrlId, scope, citation: citation.trim() }
}

export default function AuthorityScopeClaimClient({ jurisdictionId, sources }: Props) {
  const [sourceUrlId, setSourceUrlId] = useState(sources[0]?.id ?? '')
  const [scope, setScope] = useState<Scope>('UNINCORPORATED_COUNTY')
  const [citation, setCitation] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function publish() {
    if (!sourceUrlId || citation.trim().length < 10) {
      setMessage('Select a verified source and enter the authority statement from its evidence.')
      return
    }
    setSaving(true)
    setMessage(null)
    try {
      const response = await fetch(`/api/admin/jurisdictions/${jurisdictionId}/authority-scope`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authorityScopePayload(sourceUrlId, scope, citation)),
      })
      const result = await response.json() as { error?: string }
      if (!response.ok) {
        setMessage(result.error ?? 'Authority scope publication failed.')
        return
      }
      setMessage('Authority scope published. The page will refresh so it can be used for boundary review.')
      window.location.reload()
    } catch {
      setMessage('Authority scope publication failed.')
    } finally {
      setSaving(false)
    }
  }

  if (!sources.length) return <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
    No verified local-government source with an immutable evidence snapshot is available. Verify and capture the source before publishing an authority scope.
  </p>

  return <div className="space-y-4">
    <p className="text-xs leading-5 text-zinc-500">This creates a critical, individually reviewed authority claim. It does not apply county rules until the scope’s other requirements are met.</p>
    <label className="block text-xs font-medium text-zinc-700">Verified source
      <select value={sourceUrlId} onChange={event => setSourceUrlId(event.target.value)} className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm">
        {sources.map(source => <option value={source.id} key={source.id}>{source.url}</option>)}
      </select>
    </label>
    <label className="block text-xs font-medium text-zinc-700">Authority scope
      <select value={scope} onChange={event => setScope(event.target.value as Scope)} className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm">
        <option value="UNINCORPORATED_COUNTY">Unincorporated county (requires reviewed boundary)</option>
        <option value="COUNTY_WIDE">Entire county</option>
      </select>
    </label>
    <label className="block text-xs font-medium text-zinc-700">Authority statement from the evidence
      <textarea value={citation} onChange={event => setCitation(event.target.value)} rows={4} className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
    </label>
    <button type="button" onClick={publish} disabled={saving} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{saving ? 'Publishing…' : 'Publish reviewed authority scope'}</button>
    {message && <p className={message.startsWith('Authority scope published') ? 'text-sm text-emerald-700' : 'text-sm text-red-700'}>{message}</p>}
  </div>
}
