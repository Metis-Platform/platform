'use client'

import { useState } from 'react'

const PLANS = [
  {
    key: 'STARTER',
    name: 'Starter',
    price: '$39/mo',
    features: ['1 user', '10 active deals', 'AI pay-as-you-go'],
  },
  {
    key: 'PROFESSIONAL',
    name: 'Professional',
    price: '$99/mo',
    features: ['3 users', 'Unlimited deals', 'AI included'],
  },
  {
    key: 'TEAM',
    name: 'Team',
    price: '$249/mo',
    features: ['10 users', 'Unlimited deals', 'Automations', 'Advanced AI'],
  },
]

export default function BillingPage() {
  const [loading, setLoading] = useState<string | null>(null)

  async function upgrade(plan: string) {
    setLoading(plan)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } finally {
      setLoading(null)
    }
  }

  async function openPortal() {
    setLoading('portal')
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-zinc-900">Billing</h1>
        <p className="mt-1 text-sm text-zinc-500">
          14-day free trial on all plans — no credit card required to start.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 mb-8">
        {PLANS.map((plan) => (
          <div
            key={plan.key}
            className="rounded-xl border border-zinc-200 bg-white p-6 flex flex-col"
          >
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-zinc-900">{plan.name}</h2>
              <p className="text-2xl font-bold text-zinc-900 mt-1">{plan.price}</p>
            </div>
            <ul className="space-y-2 flex-1 mb-6">
              {plan.features.map((f) => (
                <li key={f} className="text-sm text-zinc-600 flex items-center gap-2">
                  <span className="text-emerald-500">✓</span> {f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => upgrade(plan.key)}
              disabled={loading === plan.key}
              className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 transition-colors"
            >
              {loading === plan.key ? 'Loading…' : 'Start free trial'}
            </button>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-base font-semibold text-zinc-900 mb-1">Manage subscription</h2>
        <p className="text-sm text-zinc-500 mb-4">
          Upgrade, downgrade, cancel, or update payment details in the Stripe billing portal.
        </p>
        <button
          onClick={openPortal}
          disabled={loading === 'portal'}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 transition-colors"
        >
          {loading === 'portal' ? 'Loading…' : 'Open billing portal'}
        </button>
      </div>
    </div>
  )
}
