'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

type FreshnessStatus = 'CURRENT' | 'REVIEW_DUE' | 'STALE'

type Claim = {
  id: string
  jurisdiction: { county: string; state: string }
  label: string
  section: string
  fieldKey: string
  value: unknown
  verificationState: string
  risk: string
  volatility: string
  status: FreshnessStatus
  lastEvidenceRetrievedAt: string
  reviewDueAt: string
  staleAt: string
  policyVersion: string
  freshnessUpdatedAt: string
  sourceUrl: string | null
  eligibleSnapshot: {
    id: string
    sourceUrl: string
    retrievedAt: string
    contentHash: string
  } | null
  reReviews: Array<{
    id: string
    explanation: string
    evidenceRetrievedAt: string
    reviewedAt: string
    reviewedBy: string
  }>
}

type Props = {
  claims: Claim[]
  freshnessStatusFilter: string
  sourceStatusFilter: string
  candidateStatusFilter: string
  sectionFilter: string
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' })
    .format(new Date(value))
}

function formatValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return 'Value unavailable'
  }
}

function statusTone(status: FreshnessStatus): string {
  if (status === 'CURRENT') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (status === 'REVIEW_DUE') return 'border-amber-200 bg-amber-50 text-amber-700'
  return 'border-red-200 bg-red-50 text-red-700'
}

function safeUrl(value: string | null): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? value : null
  } catch {
    return null
  }
}

export function ClaimFreshnessReviewClient({
  claims,
  freshnessStatusFilter,
  sourceStatusFilter,
  candidateStatusFilter,
  sectionFilter,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [explanation, setExplanation] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function changeStatus(value: string) {
    const params = new URLSearchParams({
      status: candidateStatusFilter,
      sourceStatus: sourceStatusFilter,
      freshnessStatus: value,
    })
    if (sectionFilter) params.set('section', sectionFilter)
    startTransition(() => router.push(`/admin/extraction-queue?${params}`))
  }

  function beginReview(claim: Claim) {
    setEditingId(claim.id)
    setExplanation('')
    setError(null)
  }

  async function submit(claim: Claim) {
    if (!claim.eligibleSnapshot) return
    setSaving(true)
    setError(null)
    const response = await fetch(`/api/admin/jurisdiction-claims/${claim.id}/re-review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        evidenceSnapshotId: claim.eligibleSnapshot.id,
        expectedFreshnessUpdatedAt: claim.freshnessUpdatedAt,
        explanation,
      }),
    })
    const result = await response.json().catch(() => ({})) as { error?: string }
    if (!response.ok) {
      if (
        result.error === 'STALE_CLAIM_REVIEW' ||
        result.error === 'CLAIM_SUPERSEDED' ||
        result.error === 'CLAIM_NOT_CURRENT'
      ) {
        setError('This claim changed after you opened it. The latest queue has been loaded.')
        setEditingId(null)
        startTransition(() => router.refresh())
      } else if (result.error === 'EVIDENCE_CHANGED_REVIEW_REQUIRED') {
        setError('The source content changed. Review a replacement or contradiction; it cannot be reconfirmed.')
      } else {
        setError(result.error ?? 'Claim re-review failed.')
      }
      setSaving(false)
      return
    }
    setEditingId(null)
    setSaving(false)
    startTransition(() => router.refresh())
  }

  return (
    <section aria-labelledby="claim-freshness-heading" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="claim-freshness-heading" className="text-lg font-semibold text-zinc-900">
            Claim freshness review
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-zinc-500">
            Freshness is an operational review schedule, not proof that a legal fact remains valid.
            Reconfirm only when a newer snapshot from the same source is unchanged.
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs font-medium text-zinc-500">
          Freshness
          <select
            value={freshnessStatusFilter}
            onChange={event => changeStatus(event.target.value)}
            disabled={isPending}
            className="rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm disabled:opacity-60"
          >
            <option value="CURRENT">Current</option>
            <option value="REVIEW_DUE">Review due</option>
            <option value="STALE">Stale</option>
          </select>
        </label>
      </div>

      {error && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {claims.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-200 py-10 text-center text-sm text-zinc-400">
          No active claims match this freshness state.
        </div>
      ) : (
        <div className="space-y-3">
          {claims.map(claim => {
            const isEditing = editingId === claim.id
            const sourceUrl = safeUrl(claim.sourceUrl)
            const snapshotUrl = safeUrl(claim.eligibleSnapshot?.sourceUrl ?? null)
            return (
              <article key={claim.id} className="rounded-lg border border-zinc-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusTone(claim.status)}`}>
                        {claim.status.toLowerCase().replace('_', ' ')}
                      </span>
                      <span className="text-sm font-semibold text-zinc-900">
                        {claim.jurisdiction.county}, {claim.jurisdiction.state}
                      </span>
                      <span className="text-xs text-zinc-400">{claim.verificationState.toLowerCase()}</span>
                    </div>
                    <p className="mt-2 text-sm font-medium text-zinc-800">{claim.label}</p>
                    <p className="mt-1 break-words text-sm text-zinc-600">{formatValue(claim.value)}</p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
                      <span>{claim.section}.{claim.fieldKey}</span>
                      <span>Risk: {claim.risk.toLowerCase()}</span>
                      <span>Volatility: {claim.volatility.toLowerCase()}</span>
                      <span>Evidence checked: {formatDate(claim.lastEvidenceRetrievedAt)}</span>
                      <span>Review due: {formatDate(claim.reviewDueAt)}</span>
                      <span>Stale at: {formatDate(claim.staleAt)}</span>
                      <span>Policy: {claim.policyVersion}</span>
                      {sourceUrl && (
                        <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:text-blue-900">
                          Claim source
                        </a>
                      )}
                    </div>
                    {claim.eligibleSnapshot ? (
                      <p className="mt-2 text-xs text-emerald-700">
                        Unchanged newer evidence available from {formatDate(claim.eligibleSnapshot.retrievedAt)}
                        {snapshotUrl && (
                          <> · <a href={snapshotUrl} target="_blank" rel="noopener noreferrer" className="underline">source</a></>
                        )}
                      </p>
                    ) : (
                      <p className="mt-2 text-xs text-amber-700">
                        No newer unchanged snapshot is available. Refresh the source or publish a replacement claim.
                      </p>
                    )}
                    {claim.reReviews.length > 0 && (
                      <details className="mt-2 text-xs text-zinc-500">
                        <summary className="cursor-pointer font-medium text-zinc-600">
                          Recent re-reviews ({claim.reReviews.length})
                        </summary>
                        <ul className="mt-2 space-y-2 border-l border-zinc-200 pl-3">
                          {claim.reReviews.map(review => (
                            <li key={review.id}>
                              {formatDate(review.reviewedAt)} · {review.reviewedBy}
                              <p>{review.explanation}</p>
                              <p>Evidence retrieved {formatDate(review.evidenceRetrievedAt)}</p>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => isEditing ? setEditingId(null) : beginReview(claim)}
                    disabled={!claim.eligibleSnapshot}
                    className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isEditing ? 'Cancel' : 'Reconfirm'}
                  </button>
                </div>
                {isEditing && claim.eligibleSnapshot && (
                  <div className="mt-4 border-t border-zinc-100 pt-4">
                    <label className="block text-xs font-medium text-zinc-600" htmlFor={`re-review-${claim.id}`}>
                      Re-review explanation
                    </label>
                    <textarea
                      id={`re-review-${claim.id}`}
                      value={explanation}
                      onChange={event => setExplanation(event.target.value)}
                      minLength={10}
                      required
                      className="mt-1 min-h-24 w-full rounded-md border border-zinc-200 px-2 py-2 text-sm"
                      placeholder="Explain why the newer unchanged evidence reconfirms this claim."
                    />
                    <button
                      type="button"
                      onClick={() => submit(claim)}
                      disabled={saving || explanation.trim().length < 10}
                      className="mt-3 rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                    >
                      {saving ? 'Saving…' : 'Record reconfirmation'}
                    </button>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
      <p className="text-xs text-zinc-400">{claims.length} active claim(s) shown</p>
    </section>
  )
}
