'use client'

import { useState } from 'react'

type Acceptance = {
  id: string
  contractVersion: string
  caseReference: string
  evidenceUrl: string
  result: 'PASSED' | 'FAILED'
  reviewedAt: string
}

type Props = {
  jurisdictionId: string
  currentAcceptance: Acceptance | null
  contractVersion: string
}

export default function CanonicalAcceptanceClient({ jurisdictionId, currentAcceptance, contractVersion }: Props) {
  const [result, setResult] = useState<'PASSED' | 'FAILED'>('PASSED')
  const [caseReference, setCaseReference] = useState('')
  const [evidenceUrl, setEvidenceUrl] = useState('')
  const [summary, setSummary] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function record() {
    if (caseReference.trim().length < 3 || evidenceUrl.trim().length < 8 || summary.trim().length < 10) {
      setMessage('Enter the exact case reference, immutable evidence link, and a concise outcome summary.')
      return
    }
    setSaving(true)
    setMessage(null)
    try {
      const response = await fetch(`/api/admin/jurisdictions/${jurisdictionId}/canonical-acceptance`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractVersion, caseReference: caseReference.trim(), evidenceUrl: evidenceUrl.trim(), result, summary: summary.trim(),
          replacesAcceptanceId: currentAcceptance?.id,
        }),
      })
      const payload = await response.json() as { error?: string }
      if (!response.ok) {
        setMessage(payload.error ?? 'Canonical acceptance could not be recorded.')
        return
      }
      setMessage('Acceptance recorded. The page will refresh with the new current evidence.')
      window.location.reload()
    } catch {
      setMessage('Canonical acceptance could not be recorded.')
    } finally {
      setSaving(false)
    }
  }

  return <div className="space-y-4">
    {currentAcceptance ? <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
      <p><span className="font-medium">Current decision:</span> {currentAcceptance.result} · {currentAcceptance.contractVersion}</p>
      <p className="mt-1"><span className="font-medium">Case:</span> {currentAcceptance.caseReference} · <a className="text-blue-700 hover:underline" href={currentAcceptance.evidenceUrl} target="_blank" rel="noopener noreferrer">evidence ↗</a></p>
      <p className="mt-1 text-xs text-zinc-500">Recording below supersedes this decision; the previous record remains immutable.</p>
    </div> : <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">No canonical acceptance has been recorded. This county cannot be Tier A.</p>}
    <p className="text-xs leading-5 text-zinc-500">A passed record only qualifies for Tier A while all Tier B evidence remains current and this exact contract version is current. A failed or replacement record removes Tier A.</p>
    <label className="block text-xs font-medium text-zinc-700">Acceptance result
      <select value={result} onChange={event => setResult(event.target.value as 'PASSED' | 'FAILED')} className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm">
        <option value="PASSED">Passed</option><option value="FAILED">Failed</option>
      </select>
    </label>
    <label className="block text-xs font-medium text-zinc-700">Exact acceptance case reference
      <input value={caseReference} onChange={event => setCaseReference(event.target.value)} className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
    </label>
    <label className="block text-xs font-medium text-zinc-700">Immutable evidence URL or committed artifact reference
      <input type="url" value={evidenceUrl} onChange={event => setEvidenceUrl(event.target.value)} className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
    </label>
    <label className="block text-xs font-medium text-zinc-700">Nonsensitive reviewer summary
      <textarea value={summary} onChange={event => setSummary(event.target.value)} rows={3} className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
    </label>
    <button type="button" onClick={record} disabled={saving} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{saving ? 'Recording…' : currentAcceptance ? 'Record replacement acceptance' : 'Record canonical acceptance'}</button>
    {message && <p className={message.startsWith('Acceptance recorded') ? 'text-sm text-emerald-700' : 'text-sm text-red-700'}>{message}</p>}
  </div>
}
