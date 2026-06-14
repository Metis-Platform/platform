'use client'

import { useState } from 'react'

type StrategyOption = { key: string; label: string }
type PriceRow = {
  id: string
  strategy: string
  tier: string
  stripePriceId: string | null
  displayPrice: number | null
  currency: string
  isActive: boolean
}

type Props = {
  strategies: StrategyOption[]
  prices: PriceRow[]
}

const TIERS = ['STANDARD', 'PREMIUM'] as const

export default function PricingClient({ strategies, prices: initial }: Props) {
  const [prices, setPrices] = useState<PriceRow[]>(initial)
  const [saving, setSaving] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<Record<string, string>>({})

  function getPrice(strategy: string, tier: string) {
    return prices.find(p => p.strategy === strategy && p.tier === tier)
  }

  async function save(strategy: string, tier: string, stripePriceId: string, displayPrice: string, isActive: boolean) {
    const key = `${strategy}-${tier}`
    setSaving(key)
    setFeedback(prev => ({ ...prev, [key]: '' }))

    try {
      const res = await fetch('/api/admin/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategy,
          tier,
          stripePriceId: stripePriceId || null,
          displayPrice: displayPrice ? parseFloat(displayPrice) : null,
          isActive,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setPrices(prev => {
          const next = prev.filter(p => !(p.strategy === strategy && p.tier === tier))
          return [...next, {
            id: data.id,
            strategy: data.strategy,
            tier: data.tier,
            stripePriceId: data.stripePriceId,
            displayPrice: data.displayPrice ? Number(data.displayPrice) : null,
            currency: data.currency,
            isActive: data.isActive,
          }]
        })
        setFeedback(prev => ({ ...prev, [key]: 'Saved' }))
      } else {
        setFeedback(prev => ({ ...prev, [key]: `Error: ${data.error}` }))
      }
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 border-b border-zinc-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">Module</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">Tier</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">Stripe Price ID</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">Display Price (USD)</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">Active</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {strategies.flatMap(s =>
              TIERS.map(tier => {
                const existing = getPrice(s.key, tier)
                const key = `${s.key}-${tier}`
                const isSavingThis = saving === key
                const fb = feedback[key]

                return (
                  <PriceRow
                    key={key}
                    strategyLabel={s.label}
                    strategy={s.key}
                    tier={tier}
                    existing={existing}
                    isSaving={isSavingThis}
                    feedback={fb}
                    onSave={save}
                  />
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PriceRow({
  strategyLabel, strategy, tier, existing, isSaving, feedback, onSave,
}: {
  strategyLabel: string
  strategy: string
  tier: string
  existing?: PriceRow
  isSaving: boolean
  feedback?: string
  onSave: (strategy: string, tier: string, stripePriceId: string, displayPrice: string, isActive: boolean) => void
}) {
  const [priceId, setPriceId] = useState(existing?.stripePriceId ?? '')
  const [displayPrice, setDisplayPrice] = useState(existing?.displayPrice?.toString() ?? '')
  const [isActive, setIsActive] = useState(existing?.isActive ?? true)

  return (
    <tr className="hover:bg-zinc-50">
      <td className="px-4 py-3 text-zinc-900 font-medium">{strategyLabel}</td>
      <td className="px-4 py-3">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
          tier === 'PREMIUM' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
        }`}>
          {tier === 'PREMIUM' ? 'Premium' : 'Standard'}
        </span>
      </td>
      <td className="px-4 py-3">
        <input
          value={priceId}
          onChange={e => setPriceId(e.target.value)}
          placeholder="price_xxxx"
          className="w-full max-w-xs rounded border border-zinc-300 px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-zinc-900"
        />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 max-w-[120px]">
          <span className="text-zinc-400 text-xs">$</span>
          <input
            value={displayPrice}
            onChange={e => setDisplayPrice(e.target.value)}
            placeholder="0.00"
            type="number"
            min="0"
            step="0.01"
            className="w-full rounded border border-zinc-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-900"
          />
        </div>
      </td>
      <td className="px-4 py-3">
        <input
          type="checkbox"
          checked={isActive}
          onChange={e => setIsActive(e.target.checked)}
          className="h-4 w-4 rounded border-zinc-300"
        />
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-2">
          {feedback && (
            <span className={`text-xs ${feedback.startsWith('Error') ? 'text-red-600' : 'text-emerald-600'}`}>
              {feedback}
            </span>
          )}
          <button
            onClick={() => onSave(strategy, tier, priceId, displayPrice, isActive)}
            disabled={isSaving}
            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50 transition-colors"
          >
            {isSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </td>
    </tr>
  )
}
