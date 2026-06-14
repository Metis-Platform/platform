'use client'

import { useState } from 'react'

export default function BillingPortal() {
  const [loading, setLoading] = useState(false)

  async function openPortal() {
    setLoading(true)
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6">
      <h2 className="text-base font-semibold text-zinc-900 mb-1">Manage subscription</h2>
      <p className="text-sm text-zinc-500 mb-4">
        Update payment details or view invoices in the Stripe billing portal.
      </p>
      <button
        onClick={openPortal}
        disabled={loading}
        className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Loading…' : 'Open billing portal'}
      </button>
    </div>
  )
}
