'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'

const STRATEGIES = [
  { key: 'TAX_LIEN', label: 'Tax Liens' },
  { key: 'TAX_DEED', label: 'Tax Deeds' },
] as const

export default function StrategyNav() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const active = params.get('strategy') ?? 'TAX_LIEN'

  function select(strategy: string) {
    const next = new URLSearchParams(params.toString())
    next.set('strategy', strategy)
    router.push(`${pathname}?${next.toString()}`)
  }

  return (
    <div className="inline-flex rounded-lg border border-zinc-200 overflow-hidden text-xs">
      {STRATEGIES.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => select(key)}
          className={`px-3 py-1.5 font-medium transition-colors ${
            active === key
              ? 'bg-zinc-900 text-white'
              : 'bg-white text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
