'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { JURISDICTION_AUTHORITY_CLASSES } from '@/lib/jurisdiction-authority'

type AuthorityStatus = 'UNVERIFIED' | 'VERIFIED' | 'REJECTED'

type AuthorityReview = {
  id: string
  decision: AuthorityStatus
  explanation: string
  evidenceUrl: string | null
  reviewedAt: string
  reviewedBy: string
}

type Source = {
  id: string
  url: string
  officeType: string
  lastFetchedAt: string | null
  lastContentHash: string | null
  authorityClass: string | null
  authorityOwner: string | null
  authorityStatus: AuthorityStatus
  authorityVerifiedAt: string | null
  authorityVerifiedBy: string | null
  updatedAt: string
  jurisdiction: { county: string; state: string }
  authorityReviews: AuthorityReview[]
}

type Props = {
  sources: Source[]
  sourceStatusFilter: string
  candidateStatusFilter: string
  sectionFilter: string
}

function statusTone(status: AuthorityStatus): string {
  if (status === 'VERIFIED') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (status === 'REJECTED') return 'border-red-200 bg-red-50 text-red-700'
  return 'border-amber-200 bg-amber-50 text-amber-700'
}

function formatDate(value: string | null): string {
  if (!value) return 'Never'
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' })
    .format(new Date(value))
}

function isSafeExternalUrl(value: string): boolean {
  try {
    const protocol = new URL(value).protocol
    return protocol === 'https:' || protocol === 'http:'
  } catch {
    return false
  }
}

export function SourceAuthorityReviewClient({
  sources,
  sourceStatusFilter,
  candidateStatusFilter,
  sectionFilter,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [decision, setDecision] = useState<AuthorityStatus>('VERIFIED')
  const [authorityClass, setAuthorityClass] = useState('LOCAL_OFFICIAL')
  const [authorityOwner, setAuthorityOwner] = useState('')
  const [evidenceUrl, setEvidenceUrl] = useState('')
  const [explanation, setExplanation] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const canSubmit = explanation.trim().length >= 10 && (
    decision !== 'VERIFIED' || (
      authorityOwner.trim().length >= 2 && isSafeExternalUrl(evidenceUrl)
    )
  )

  function changeStatus(value: string) {
    const params = new URLSearchParams({ status: candidateStatusFilter })
    if (sectionFilter) params.set('section', sectionFilter)
    if (value) params.set('sourceStatus', value)
    startTransition(() => router.push(`/admin/extraction-queue?${params}`))
  }

  function beginReview(source: Source) {
    setEditingId(source.id)
    setDecision(source.authorityStatus === 'VERIFIED' ? 'UNVERIFIED' : 'VERIFIED')
    setAuthorityClass(source.authorityClass ?? 'LOCAL_OFFICIAL')
    setAuthorityOwner(source.authorityOwner ?? '')
    setEvidenceUrl(source.url)
    setExplanation('')
    setError(null)
  }

  async function submit(source: Source) {
    setSaving(true)
    setError(null)
    const body = decision === 'VERIFIED'
      ? {
          decision,
          expectedUpdatedAt: source.updatedAt,
          authorityClass,
          authorityOwner,
          evidenceUrl,
          explanation,
        }
      : { decision, expectedUpdatedAt: source.updatedAt, explanation }

    const response = await fetch(`/api/admin/jurisdiction-sources/${source.id}/authority`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const result = await response.json().catch(() => ({})) as { error?: string }
    if (!response.ok) {
      if (result.error === 'STALE_SOURCE') {
        setError('This source changed after you opened it. The latest version has been loaded; review it again.')
        setEditingId(null)
        startTransition(() => router.refresh())
      } else {
        setError(result.error ?? 'Authority review failed.')
      }
      setSaving(false)
      return
    }

    setEditingId(null)
    setSaving(false)
    startTransition(() => router.refresh())
  }

  return (
    <section aria-labelledby="source-authority-heading" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="source-authority-heading" className="text-lg font-semibold text-zinc-900">
            Source authority review
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-zinc-500">
            Discovery does not prove authority. A verified decision affects future claim reviews only;
            existing claims are never silently promoted.
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs font-medium text-zinc-500">
          Source status
          <select
            value={sourceStatusFilter}
            onChange={event => changeStatus(event.target.value)}
            disabled={isPending}
            className="rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm disabled:opacity-60"
          >
            <option value="UNVERIFIED">Unverified</option>
            <option value="VERIFIED">Verified</option>
            <option value="REJECTED">Rejected</option>
            <option value="ALL">All</option>
          </select>
        </label>
      </div>

      {error && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {sources.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-200 py-10 text-center text-sm text-zinc-400">
          No sources match this authority status.
        </div>
      ) : (
        <div className="space-y-3">
          {sources.map(source => {
            const isEditing = editingId === source.id
            const sourceUrlIsSafe = isSafeExternalUrl(source.url)
            return (
              <article key={source.id} className="rounded-lg border border-zinc-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusTone(source.authorityStatus)}`}>
                        {source.authorityStatus.toLowerCase()}
                      </span>
                      <span className="text-sm font-semibold text-zinc-900">
                        {source.jurisdiction.county}, {source.jurisdiction.state}
                      </span>
                      <span className="text-xs text-zinc-400">{source.officeType.replaceAll('_', ' ')}</span>
                    </div>
                    {sourceUrlIsSafe ? (
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 block truncate text-sm text-blue-700 hover:text-blue-900"
                      >
                        {source.url}
                      </a>
                    ) : (
                      <p className="mt-2 truncate text-sm text-red-700">Unsafe URL: {source.url}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
                      <span>Fetched: {formatDate(source.lastFetchedAt)}</span>
                      <span>Version: {formatDate(source.updatedAt)}</span>
                      <span>Hash: {source.lastContentHash?.slice(0, 12) ?? 'Unavailable'}</span>
                      {source.authorityOwner && <span>Owner: {source.authorityOwner}</span>}
                      {source.authorityClass && <span>Class: {source.authorityClass}</span>}
                      {source.authorityVerifiedAt && (
                        <span>
                          Authority verified: {formatDate(source.authorityVerifiedAt)}
                          {source.authorityVerifiedBy ? ` by ${source.authorityVerifiedBy}` : ''}
                        </span>
                      )}
                    </div>
                    {source.authorityReviews.length > 0 && (
                      <details className="mt-2 text-xs text-zinc-500">
                        <summary className="cursor-pointer font-medium text-zinc-600">
                          Recent authority decisions ({source.authorityReviews.length})
                        </summary>
                        <ul className="mt-2 space-y-2 border-l border-zinc-200 pl-3">
                          {source.authorityReviews.map(review => (
                            <li key={review.id}>
                              <span className="font-medium">{review.decision.toLowerCase()}</span>
                              {' · '}{formatDate(review.reviewedAt)} · {review.reviewedBy}
                              <p className="mt-0.5">{review.explanation}</p>
                              {review.evidenceUrl && isSafeExternalUrl(review.evidenceUrl) && (
                                <a
                                  href={review.evidenceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-700 hover:text-blue-900"
                                >
                                  Authority evidence
                                </a>
                              )}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => isEditing ? setEditingId(null) : beginReview(source)}
                    className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    {isEditing ? 'Cancel' : 'Review'}
                  </button>
                </div>

                {isEditing && (
                  <div className="mt-4 grid gap-3 border-t border-zinc-100 pt-4 md:grid-cols-2">
                    <label className="text-xs font-medium text-zinc-600">
                      Decision
                      <select
                        value={decision}
                        onChange={event => setDecision(event.target.value as AuthorityStatus)}
                        className="mt-1 w-full rounded-md border border-zinc-200 px-2 py-2 text-sm"
                      >
                        <option value="VERIFIED">Verify authority</option>
                        <option value="REJECTED">Reject source</option>
                        <option value="UNVERIFIED">Reset to unverified</option>
                      </select>
                    </label>
                    {decision === 'VERIFIED' && (
                      <>
                        <label className="text-xs font-medium text-zinc-600">
                          Authority class
                          <select
                            value={authorityClass}
                            onChange={event => setAuthorityClass(event.target.value)}
                            className="mt-1 w-full rounded-md border border-zinc-200 px-2 py-2 text-sm"
                          >
                            {JURISDICTION_AUTHORITY_CLASSES.map(value => (
                              <option key={value} value={value}>{value}</option>
                            ))}
                          </select>
                        </label>
                        <label className="text-xs font-medium text-zinc-600">
                          Authority owner
                          <input
                            value={authorityOwner}
                            onChange={event => setAuthorityOwner(event.target.value)}
                            minLength={2}
                            required
                            className="mt-1 w-full rounded-md border border-zinc-200 px-2 py-2 text-sm"
                            placeholder="County Planning Department"
                          />
                        </label>
                        <label className="text-xs font-medium text-zinc-600">
                          Authority evidence URL
                          <input
                            type="url"
                            value={evidenceUrl}
                            onChange={event => setEvidenceUrl(event.target.value)}
                            required
                            className="mt-1 w-full rounded-md border border-zinc-200 px-2 py-2 text-sm"
                          />
                        </label>
                      </>
                    )}
                    <label className="text-xs font-medium text-zinc-600 md:col-span-2">
                      Explanation
                      <textarea
                        value={explanation}
                        onChange={event => setExplanation(event.target.value)}
                        minLength={10}
                        required
                        className="mt-1 min-h-24 w-full rounded-md border border-zinc-200 px-2 py-2 text-sm"
                        placeholder={decision === 'VERIFIED'
                          ? 'Explain how the evidence establishes ownership and authority.'
                          : 'Explain why this source is rejected or must be reviewed again.'}
                      />
                    </label>
                    <div className="md:col-span-2">
                      <button
                        type="button"
                        onClick={() => submit(source)}
                        disabled={saving || !canSubmit}
                        className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                      >
                        {saving ? 'Saving…' : 'Record authority decision'}
                      </button>
                    </div>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
      <p className="text-xs text-zinc-400">{sources.length} source(s) shown</p>
    </section>
  )
}
