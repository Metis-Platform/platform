'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { markNotWon, relistAsLead } from '@/lib/actions/lien'

export function NotWonButton({ dealId, auctionDate }: { dealId: string; auctionDate?: string | null }) {
  const [showForm, setShowForm] = useState(false)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    startTransition(async () => {
      const result = await markNotWon(dealId, note || null)
      if (result.error) {
        setError(result.error)
      } else {
        router.refresh()
      }
    })
  }

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className="px-3 py-1.5 text-sm font-medium text-zinc-600 border border-zinc-300 rounded-lg hover:bg-zinc-50 transition-colors"
      >
        Not Won
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-start gap-2 flex-wrap">
      <div className="flex flex-col gap-1">
        {auctionDate && (
          <p className="text-xs text-zinc-400">Auction: {new Date(auctionDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
        )}
        <input
          type="text"
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Optional note (e.g. outbid at $8,200)"
          maxLength={500}
          className="text-sm border border-zinc-200 rounded-lg px-2 py-1.5 w-64 text-zinc-700"
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
      <button type="submit" disabled={pending}
        className="px-3 py-1.5 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors">
        {pending ? 'Saving…' : 'Confirm Not Won'}
      </button>
      <button type="button" onClick={() => setShowForm(false)}
        className="px-3 py-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-700 transition-colors">
        Cancel
      </button>
    </form>
  )
}

export function RelistButton({ dealId }: { dealId: string }) {
  const [showForm, setShowForm] = useState(false)
  const [auctionDate, setAuctionDate] = useState('')
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    startTransition(async () => {
      const result = await relistAsLead(dealId, auctionDate || null)
      if (result.error) {
        setError(result.error)
      } else {
        router.refresh()
      }
    })
  }

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className="px-3 py-1.5 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
      >
        Re-list as Lead
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-start gap-2 flex-wrap">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-zinc-500">New Auction Date (optional)</label>
        <input
          type="date"
          value={auctionDate}
          onChange={e => setAuctionDate(e.target.value)}
          className="text-sm border border-zinc-200 rounded-lg px-2 py-1.5 text-zinc-700"
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
      <button type="submit" disabled={pending}
        className="px-3 py-1.5 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 disabled:opacity-50 transition-colors mt-5">
        {pending ? 'Saving…' : 'Re-list as Lead'}
      </button>
      <button type="button" onClick={() => setShowForm(false)}
        className="px-3 py-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-700 transition-colors mt-5">
        Cancel
      </button>
    </form>
  )
}
