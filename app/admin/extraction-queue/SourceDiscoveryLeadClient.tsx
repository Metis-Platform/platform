'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

type Lead = {
  id: string
  officeType: string
  url: string
  authorityOwner: string | null
  authorityRationale: string
  candidateScope: 'DISCOVERY_ENTRYPOINT' | 'COUNTY_OFFICE_CANDIDATE'
  updatedAt: string
  jurisdiction: { county: string; state: string }
}

function isSafeExternalUrl(value: string) {
  try {
    const protocol = new URL(value).protocol
    return protocol === 'https:' || protocol === 'http:'
  } catch {
    return false
  }
}

export function SourceDiscoveryLeadClient({ leads }: { leads: Lead[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [sourceUrl, setSourceUrl] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function promote(lead: Lead) {
    setError(null)
    const response = await fetch(`/api/admin/jurisdiction-source-discovery-leads/${lead.id}/promote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceUrl, expectedUpdatedAt: lead.updatedAt }),
    })
    if (!response.ok) {
      const result = await response.json().catch(() => ({})) as { error?: string }
      setError(result.error ?? 'Promotion failed.')
      return
    }
    setEditingId(null)
    startTransition(() => router.refresh())
  }

  return (
    <section aria-labelledby="source-discovery-heading" className="mb-10 space-y-4">
      <div>
        <h2 id="source-discovery-heading" className="text-lg font-semibold text-zinc-900">Discovered source leads</h2>
        <p className="mt-1 max-w-3xl text-sm text-zinc-500">
          These are starting points, not approved sources. Promote only after confirming a concrete county-office URL;
          the new source remains unverified until a separate authority review.
        </p>
      </div>
      {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {leads.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-200 py-8 text-center text-sm text-zinc-400">No pending discovery leads.</div>
      ) : (
        <div className="space-y-3">
          {leads.map(lead => {
            const editing = editingId === lead.id
            return (
              <article key={lead.id} className="rounded-lg border border-zinc-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">pending review</span>
                      <span className="text-sm font-semibold text-zinc-900">{lead.jurisdiction.county}, {lead.jurisdiction.state}</span>
                      <span className="text-xs text-zinc-400">{lead.officeType.replaceAll('_', ' ')}</span>
                      <span className="text-xs text-zinc-400">{lead.candidateScope === 'DISCOVERY_ENTRYPOINT' ? 'entry point — replace URL required' : 'county-office candidate'}</span>
                    </div>
                    {isSafeExternalUrl(lead.url) ? (
                      <a href={lead.url} target="_blank" rel="noopener noreferrer" className="mt-2 block truncate text-sm text-blue-700 hover:text-blue-900">{lead.url}</a>
                    ) : <p className="mt-2 text-sm text-red-700">Unsafe URL: {lead.url}</p>}
                    <p className="mt-2 text-xs text-zinc-500">{lead.authorityRationale}</p>
                    {lead.authorityOwner && <p className="mt-1 text-xs text-zinc-500">Suggested owner: {lead.authorityOwner}</p>}
                  </div>
                  <button type="button" onClick={() => { setEditingId(editing ? null : lead.id); setSourceUrl(lead.url); setError(null) }} className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
                    {editing ? 'Cancel' : 'Review and promote'}
                  </button>
                </div>
                {editing && (
                  <div className="mt-4 flex flex-col gap-2 border-t border-zinc-100 pt-4 sm:flex-row">
                    <label className="flex-1 text-xs font-medium text-zinc-600">Concrete county-office URL{lead.candidateScope === 'DISCOVERY_ENTRYPOINT' ? ' (must differ from entry point)' : ''}
                      <input value={sourceUrl} onChange={event => setSourceUrl(event.target.value)} className="mt-1 w-full rounded-md border border-zinc-200 px-2 py-2 text-sm" />
                    </label>
                    <button type="button" onClick={() => promote(lead)} disabled={isPending} className="mt-5 rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60">{isPending ? 'Promoting…' : 'Promote unverified source'}</button>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
