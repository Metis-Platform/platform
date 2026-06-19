'use client'

import { useActionState } from 'react'
import { syncLandFromResearch } from '@/lib/actions/land'

export default function LandSyncButton({ dealId }: { dealId: string }) {
  const boundAction = syncLandFromResearch.bind(null, dealId)
  const [state, formAction, pending] = useActionState(boundAction, {})

  return (
    <form action={formAction}>
      <button
        type="submit"
        disabled={pending}
        className="text-xs text-zinc-500 hover:text-zinc-900 transition-colors disabled:opacity-40"
      >
        {pending ? 'Syncing…' : 'Sync from research'}
      </button>
      {state?.message && (
        <p className={`mt-2 text-xs ${state.updated ? 'text-emerald-600' : 'text-zinc-400'}`}>
          {state.message}
        </p>
      )}
    </form>
  )
}
