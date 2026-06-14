'use client'

import { useState } from 'react'

type Props = {
  strategy: string
  tier?: 'STANDARD' | 'PREMIUM'
  purchaseEnabled: boolean
  salesUrl: string
}

export default function PurchaseModuleButton({ strategy, tier = 'STANDARD', purchaseEnabled, salesUrl }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handlePurchase() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/billing/module-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategy, tier }),
      })
      const data = await res.json()
      if (res.ok && data.url) {
        window.location.href = data.url
      } else {
        setError(data.error ?? 'Something went wrong')
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  if (!purchaseEnabled) {
    return (
      <a
        href={salesUrl}
        className="inline-flex items-center justify-center rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
      >
        Contact us to add
      </a>
    )
  }

  return (
    <div>
      <button
        onClick={handlePurchase}
        disabled={loading}
        className="inline-flex items-center justify-center rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Redirecting…' : 'Purchase module'}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}
