'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

export default function JurisdictionResearchWorkControls({
  workId,
  status,
}: {
  workId: string
  status: 'DISCOVERING' | 'PAUSED'
}) {
  const router = useRouter()
  const [pauseReason, setPauseReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function update(status: 'DISCOVERING' | 'PAUSED') {
    startTransition(async () => {
      setError(null)
      try {
        const response = await fetch(`/api/admin/jurisdiction-research/${workId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status,
            pausedReason: status === 'PAUSED' ? pauseReason : undefined,
          }),
        })
        if (!response.ok) {
          setError('Unable to update this work item. Try again in a moment.')
          return
        }
        setPauseReason('')
        router.refresh()
      } catch {
        setError('Unable to update this work item. Try again in a moment.')
      }
    })
  }

  if (status === 'PAUSED') {
    return (
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => update('DISCOVERING')}
          disabled={isPending}
          className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
        >
          {isPending ? 'Resuming…' : 'Resume discovery'}
        </button>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <label className="sr-only" htmlFor={`pause-reason-${workId}`}>Pause reason</label>
      <input
        id={`pause-reason-${workId}`}
        value={pauseReason}
        onChange={(event) => setPauseReason(event.target.value)}
        placeholder="Pause reason"
        className="w-40 rounded-md border border-zinc-300 px-2 py-1 text-xs"
      />
      <button
        type="button"
        onClick={() => update('PAUSED')}
        disabled={isPending || pauseReason.trim().length === 0}
        className="ml-2 rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
      >
        {isPending ? 'Pausing…' : 'Pause'}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
