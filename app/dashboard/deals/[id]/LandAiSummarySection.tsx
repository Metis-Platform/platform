'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'

export default function LandAiSummarySection({
  dealId,
  initialSummary,
  initialGeneratedAt,
}: {
  dealId: string
  initialSummary: string | null
  initialGeneratedAt: string | null
}) {
  const [summary, setSummary] = useState(initialSummary)
  const [generatedAt, setGeneratedAt] = useState(initialGeneratedAt)
  const [error, setError] = useState<string | null>(null)
  const [settingsUrl, setSettingsUrl] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function generate() {
    setError(null)
    setSettingsUrl(null)
    startTransition(async () => {
      const res = await fetch(`/api/deals/${dealId}/land/ai-summary`, { method: 'POST' })
      const body = await res.json().catch(() => null) as { summary?: string; generatedAt?: string; error?: string; settingsUrl?: string } | null
      if (!res.ok) {
        setError(body?.error ?? 'Summary generation failed.')
        setSettingsUrl(body?.settingsUrl ?? null)
        return
      }
      setSummary(body?.summary ?? null)
      setGeneratedAt(body?.generatedAt ?? null)
    })
  }

  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-zinc-900">AI Parcel Summary</h2>
        <button
          onClick={generate}
          disabled={isPending}
          className="text-xs text-violet-600 hover:text-violet-800 font-medium transition-colors disabled:opacity-50"
        >
          {isPending ? 'Generating…' : summary ? 'Regenerate' : 'Generate'}
        </button>
      </div>

      {!summary && !isPending && !error && (
        <p className="text-sm text-zinc-400">No summary generated yet.</p>
      )}

      {summary && (
        <>
          <p className="text-sm text-zinc-700 whitespace-pre-wrap">{summary}</p>
          {generatedAt && (
            <p className="mt-3 text-xs text-zinc-400">
              Generated {new Date(generatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
            </p>
          )}
        </>
      )}

      {error && (
        <p className="mt-3 text-sm text-red-600">
          {error}
          {settingsUrl && (
            <>
              {' '}
              <Link href={settingsUrl} className="underline">Add your API key</Link>
            </>
          )}
        </p>
      )}
    </div>
  )
}
