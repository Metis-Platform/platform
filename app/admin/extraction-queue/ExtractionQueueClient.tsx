'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  claimValuesConflict,
  extractedClaimValue,
} from '@/lib/jurisdiction-claim-contradiction'

type Candidate = {
  id: string
  section: string
  fieldKey: string
  extractedValue: unknown
  confidence: number
  sourceSnippet: string | null
  modelUsed: string
  status: string
  updatedAt: string
  jurisdiction: { county: string; state: string }
  sourceUrl: { url: string; officeType: string } | null
  currentClaim: {
    id: string
    value: unknown
    normalizedUnit: string | null
  } | null
  potentialContradiction: boolean
  contradictionReviews: Array<{
    id: string
    decision: string
    explanation: string
    existingValue: unknown
    proposedValue: unknown
    reviewedAt: string
    reviewedBy: string
    replacementClaimId: string | null
  }>
}

type Props = {
  candidates: Candidate[]
  pendingCount: number
  statusFilter: string
  sectionFilter: string
  sourceStatusFilter: string
  freshnessStatusFilter: string
  allSections: string[]
}

function confidenceColor(c: number) {
  if (c >= 0.85) return 'text-green-700 bg-green-50 border-green-200'
  if (c >= 0.6) return 'text-amber-700 bg-amber-50 border-amber-200'
  return 'text-red-700 bg-red-50 border-red-200'
}

function formatReviewDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(value))
}

function actionErrorMessage(code: string | undefined, fallback: string): string {
  if (code === 'STALE_CLAIM_CONTRADICTION' || code === 'CANDIDATE_NOT_PENDING') {
    return 'The candidate or current claim changed. Refresh the queue before deciding.'
  }
  if (code === 'CLAIM_CONTRADICTION_RESOLUTION_REQUIRED') {
    return 'This evidence conflicts with the current claim and requires an explicit resolution.'
  }
  if (code === 'CLAIM_CONTRADICTION_EVIDENCE_REQUIRED') {
    return 'The conflicting evidence snapshot is incomplete and cannot be resolved.'
  }
  return code ?? fallback
}

export function ExtractionQueueClient({
  candidates: initialCandidates,
  pendingCount: initialPendingCount,
  statusFilter,
  sectionFilter,
  sourceStatusFilter,
  freshnessStatusFilter,
  allSections,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [candidates, setCandidates] = useState(initialCandidates)
  const [pendingCount, setPendingCount] = useState(initialPendingCount)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [resolutionExplanation, setResolutionExplanation] = useState('')
  const [batchMinConf, setBatchMinConf] = useState(85)
  const [batchLoading, setBatchLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  function changeFilter(key: string, value: string) {
    const params = new URLSearchParams()
    if (key !== 'status') params.set('status', statusFilter)
    if (key !== 'section') { if (sectionFilter) params.set('section', sectionFilter) }
    if (sourceStatusFilter) params.set('sourceStatus', sourceStatusFilter)
    params.set('freshnessStatus', freshnessStatusFilter)
    if (value) params.set(key, value)
    startTransition(() => router.push(`/admin/extraction-queue?${params}`))
  }

  function refresh() {
    startTransition(() => router.refresh())
  }

  async function approve(candidate: Candidate, editedValue?: string) {
    setActionError(null)
    setActionLoading(candidate.id)
    const body: Record<string, unknown> = {}
    let proposedValue = extractedClaimValue(candidate.extractedValue)
    if (editedValue !== undefined) {
      try { body.value = JSON.parse(editedValue) } catch { body.value = editedValue }
      proposedValue = { ...proposedValue, value: body.value }
    }
    const currentClaim = candidate.currentClaim
    const contradiction = currentClaim && claimValuesConflict(
      currentClaim,
      proposedValue,
    )
    if (contradiction) {
      if (resolutionExplanation.trim().length < 10) {
        setActionError('Explain the conflicting evidence before replacing the current claim.')
        setActionLoading(null)
        return
      }
      body.contradiction = {
        expectedCurrentClaimId: currentClaim.id,
        expectedCandidateUpdatedAt: candidate.updatedAt,
        explanation: resolutionExplanation,
      }
    }
    const res = await fetch(`/api/admin/extraction-candidates/${candidate.id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      setCandidates(prev => prev.filter(c => c.id !== candidate.id))
      setPendingCount(prev => Math.max(0, prev - 1))
      setEditingId(null)
      setResolutionExplanation('')
    } else {
      const result = await res.json().catch(() => ({})) as { error?: string }
      setActionError(actionErrorMessage(result.error, 'Candidate could not be approved.'))
    }
    setActionLoading(null)
  }

  async function reject(
    candidate: Candidate,
    decision?: 'REJECTED_CHALLENGE' | 'NOT_COMPARABLE',
  ) {
    setActionError(null)
    if (candidate.potentialContradiction && (
      !decision || resolutionExplanation.trim().length < 10 || !candidate.currentClaim
    )) {
      setActionError('Choose a contradiction outcome and provide an explanation of at least 10 characters.')
      return
    }
    setActionLoading(candidate.id)
    const res = await fetch(`/api/admin/extraction-candidates/${candidate.id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expectedCandidateUpdatedAt: candidate.updatedAt,
        ...(decision && candidate.currentClaim ? {
          contradiction: {
            expectedCurrentClaimId: candidate.currentClaim.id,
            decision,
            explanation: resolutionExplanation,
          },
        } : {}),
      }),
    })
    if (res.ok) {
      setCandidates(prev => prev.filter(c => c.id !== candidate.id))
      setPendingCount(prev => Math.max(0, prev - 1))
      setEditingId(null)
      setResolutionExplanation('')
    } else {
      const result = await res.json().catch(() => ({})) as { error?: string }
      setActionError(actionErrorMessage(result.error, 'Candidate could not be rejected.'))
    }
    setActionLoading(null)
  }

  async function batchApprove() {
    setActionError(null)
    setBatchLoading(true)
    const response = await fetch('/api/admin/extraction-queue/batch-approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ minConfidence: batchMinConf / 100, section: sectionFilter || undefined }),
    })
    const result = await response.json().catch(() => ({})) as { blocked?: number; errors?: number }
    if (!response.ok) {
      setActionError('Batch review failed.')
    } else if ((result.blocked ?? 0) > 0 || (result.errors ?? 0) > 0) {
      setActionError(
        `${result.blocked ?? 0} field(s) require individual review; ${result.errors ?? 0} failed.`
      )
    }
    setBatchLoading(false)
    refresh()
  }

  return (
    <div className="space-y-4">
      {actionError && (
        <div role="alert" className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {actionError}
        </div>
      )}
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-zinc-500">Status</label>
          <select
            value={statusFilter}
            onChange={e => changeFilter('status', e.target.value)}
            disabled={isPending}
            className="text-sm border border-zinc-200 rounded-md px-2 py-1.5 bg-white disabled:opacity-60"
          >
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-zinc-500">Section</label>
          <select
            value={sectionFilter}
            onChange={e => changeFilter('section', e.target.value)}
            disabled={isPending}
            className="text-sm border border-zinc-200 rounded-md px-2 py-1.5 bg-white disabled:opacity-60"
          >
            <option value="">All sections</option>
            {allSections.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {statusFilter === 'PENDING' && (
            <>
              <label className="text-xs font-medium text-zinc-500">Batch review eligible ≥</label>
              <select
                value={batchMinConf}
                onChange={e => setBatchMinConf(Number(e.target.value))}
                className="text-sm border border-zinc-200 rounded-md px-2 py-1.5 bg-white"
              >
                {[95, 90, 85, 80, 75, 70].map(v => (
                  <option key={v} value={v}>{v}%</option>
                ))}
              </select>
              <button
                onClick={batchApprove}
                disabled={batchLoading || candidates.length === 0}
                className="px-3 py-1.5 text-sm font-medium bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                {batchLoading ? 'Reviewing…' : 'Approve eligible'}
              </button>
            </>
          )}
          <button
            onClick={refresh}
            disabled={isPending}
            className="px-3 py-1.5 text-sm border border-zinc-200 rounded-md hover:bg-zinc-50 disabled:opacity-60"
          >
            {isPending ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Table */}
      {candidates.length === 0 ? (
        <div className="text-sm text-zinc-400 py-12 text-center border border-dashed border-zinc-200 rounded-lg">
          {statusFilter === 'PENDING' ? 'No candidates pending review.' : `No ${statusFilter.toLowerCase()} candidates.`}
        </div>
      ) : (
        <div className="overflow-hidden border border-zinc-200 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-600 text-xs">Jurisdiction</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-600 text-xs">Field</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-600 text-xs">Extracted Value</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-600 text-xs w-40">Source Snippet</th>
                <th className="text-center px-4 py-2.5 font-medium text-zinc-600 text-xs w-20">Conf.</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-600 text-xs w-20">Model</th>
                {statusFilter === 'PENDING' && <th className="px-4 py-2.5 text-xs w-64" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {candidates.map(c => {
                const extracted = c.extractedValue as Record<string, unknown>
                const displayValue = JSON.stringify(extracted.value ?? extracted)
                const isEditing = editingId === c.id
                let editedClaimValue = extractedClaimValue(c.extractedValue)
                if (isEditing) {
                  try { editedClaimValue = { ...editedClaimValue, value: JSON.parse(editValue) } }
                  catch { editedClaimValue = { ...editedClaimValue, value: editValue } }
                }
                const liveContradiction = Boolean(
                  c.currentClaim && claimValuesConflict(c.currentClaim, editedClaimValue),
                )

                return (
                  <tr key={c.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-3 text-zinc-900 whitespace-nowrap">
                      {c.jurisdiction.county}, {c.jurisdiction.state}
                      {c.sourceUrl && (
                        <div className="text-xs text-zinc-400 mt-0.5">{c.sourceUrl.officeType.replace(/_/g, ' ')}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-700 whitespace-nowrap">
                      <span className="text-zinc-400">{c.section}.</span>{c.fieldKey}
                    </td>
                    <td className="px-4 py-3 text-zinc-800 max-w-xs">
                      {isEditing && !c.potentialContradiction ? (
                        <input
                          type="text"
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          className="w-full text-sm border border-blue-300 rounded px-2 py-1 font-mono"
                          autoFocus
                        />
                      ) : (
                        <div>
                          <span className="font-mono text-xs">{displayValue}</span>
                          {c.potentialContradiction && (
                            <div className="mt-2 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-800">
                              <strong>Potential contradiction</strong>
                              <span className="mt-1 block font-mono">
                                Current: {JSON.stringify(c.currentClaim?.value)}
                              </span>
                              <span className="mt-1 block">
                                Investors see this field as blocked while the candidate remains pending.
                              </span>
                            </div>
                          )}
                          {c.contradictionReviews.length > 0 && (
                            <details className="mt-2 text-xs text-zinc-500">
                              <summary className="cursor-pointer font-medium">
                                Contradiction decisions ({c.contradictionReviews.length})
                              </summary>
                              <ul className="mt-1 space-y-2 border-l border-zinc-200 pl-2">
                                {c.contradictionReviews.map(review => (
                                  <li key={review.id}>
                                    <strong>{review.decision.toLowerCase().replaceAll('_', ' ')}</strong>
                                    {' · '}{formatReviewDate(review.reviewedAt)} UTC
                                    <span className="block">{review.explanation}</span>
                                  </li>
                                ))}
                              </ul>
                            </details>
                          )}
                        </div>
                      )}
                      {isEditing && liveContradiction && (
                        <textarea
                          value={resolutionExplanation}
                          onChange={event => setResolutionExplanation(event.target.value)}
                          minLength={10}
                          required
                          className="mt-2 min-h-20 w-full rounded border border-red-200 px-2 py-1 text-xs"
                          placeholder="Explain why this conflict should replace, reject, or remain non-comparable."
                        />
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500 max-w-xs">
                      {c.sourceSnippet ? (
                        <span className="line-clamp-3 italic">&ldquo;{c.sourceSnippet}&rdquo;</span>
                      ) : (
                        <span className="text-zinc-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium border ${confidenceColor(c.confidence)}`}>
                        {(c.confidence * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-400 whitespace-nowrap">
                      {c.modelUsed.includes('haiku') ? 'Haiku' : 'Sonnet'}
                    </td>
                    {statusFilter === 'PENDING' && (
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {isEditing ? (
                            liveContradiction ? <>
                              <button
                                onClick={() => approve(c, c.potentialContradiction ? undefined : editValue)}
                                disabled={actionLoading === c.id || resolutionExplanation.trim().length < 10}
                                className="px-2 py-1 text-xs font-medium bg-red-700 text-white rounded hover:bg-red-800 disabled:opacity-50"
                              >Replace</button>
                              {c.potentialContradiction && <button
                                onClick={() => reject(c, 'REJECTED_CHALLENGE')}
                                disabled={actionLoading === c.id || resolutionExplanation.trim().length < 10}
                                className="px-2 py-1 text-xs border border-red-200 text-red-700 rounded hover:bg-red-50 disabled:opacity-50"
                              >Reject challenge</button>}
                              {c.potentialContradiction && <button
                                onClick={() => reject(c, 'NOT_COMPARABLE')}
                                disabled={actionLoading === c.id || resolutionExplanation.trim().length < 10}
                                className="px-2 py-1 text-xs border border-amber-200 text-amber-700 rounded hover:bg-amber-50 disabled:opacity-50"
                              >Not comparable</button>}
                              <button
                                onClick={() => { setEditingId(null); setResolutionExplanation('') }}
                                className="px-2 py-1 text-xs border border-zinc-200 rounded hover:bg-zinc-50"
                              >Cancel</button>
                            </> : <>
                              <button
                                onClick={() => approve(c, editValue)}
                                disabled={actionLoading === c.id}
                                className="px-2 py-1 text-xs font-medium bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                              >Save & Approve</button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="px-2 py-1 text-xs border border-zinc-200 rounded hover:bg-zinc-50"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              {!c.potentialContradiction && <button
                                onClick={() => approve(c)}
                                disabled={actionLoading === c.id}
                                className="px-2 py-1 text-xs font-medium bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                              >{actionLoading === c.id ? '…' : 'Approve'}</button>}
                              <button
                                onClick={() => {
                                  setEditingId(c.id)
                                  setEditValue(displayValue.replace(/^"|"$/g, ''))
                                  setResolutionExplanation('')
                                }}
                                className="px-2 py-1 text-xs border border-zinc-200 rounded hover:bg-zinc-50"
                              >
                                {c.potentialContradiction ? 'Resolve' : 'Edit'}
                              </button>
                              {!c.potentialContradiction && <button
                                onClick={() => reject(c)}
                                disabled={actionLoading === c.id}
                                className="px-2 py-1 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50 disabled:opacity-50"
                              >
                                Reject
                              </button>}
                            </>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-zinc-400">
        {candidates.length} shown · {pendingCount} total pending
      </p>
    </div>
  )
}
