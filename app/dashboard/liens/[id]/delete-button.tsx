'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteLien } from '@/lib/actions/lien'

export function DeleteButton({ dealId }: { dealId: string }) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function handleDelete() {
    if (!confirm('Delete this lien and all associated events? This cannot be undone.')) return
    startTransition(async () => {
      const result = await deleteLien(dealId)
      if (result.error) {
        alert(result.error)
      } else {
        router.push('/dashboard/liens')
      }
    })
  }

  return (
    <button
      onClick={handleDelete}
      disabled={pending}
      className="px-3 py-1.5 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {pending ? 'Deleting…' : 'Delete'}
    </button>
  )
}
