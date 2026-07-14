'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

export default function JurisdictionSourceDiscoveryControls({ jurisdictionId }: { jurisdictionId: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  async function discover() {
    setError(null)
    const response = await fetch(`/api/admin/jurisdictions/${jurisdictionId}/source-discovery`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    })
    if (!response.ok) {
      const result = await response.json().catch(() => ({})) as { error?: string }
      setError(result.error ?? 'Discovery failed.')
      return
    }
    startTransition(() => router.refresh())
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={discover}
        disabled={isPending}
        className="rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
      >
        {isPending ? 'Discovering…' : 'Discover sources'}
      </button>
      {error && <span role="alert" className="max-w-48 text-xs text-red-700">{error}</span>}
    </div>
  )
}
