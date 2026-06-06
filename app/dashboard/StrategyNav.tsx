'use client'

import Link from 'next/link'
import { useSearchParams, usePathname, useRouter } from 'next/navigation'
import { ALL_STRATEGIES } from '@/lib/strategy-meta'

/** Module pill switcher — updates the ?strategy= param on the current page. */
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
    <div className="inline-flex rounded-lg border border-zinc-200 overflow-x-auto text-xs">
      {ALL_STRATEGIES.map(({ key, navLabel }) => (
        <button
          key={key}
          onClick={() => select(key)}
          className={`px-3 py-1.5 font-medium transition-colors whitespace-nowrap ${
            active === key
              ? 'bg-zinc-900 text-white'
              : 'bg-white text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50'
          }`}
        >
          {navLabel}
        </button>
      ))}
    </div>
  )
}

/**
 * "Deals" nav link that carries the current ?strategy= param so switching
 * modules on the dashboard or deals page doesn't reset when you click Deals.
 */
export function DealsNavLink({ className }: { className: string }) {
  const params = useSearchParams()
  const pathname = usePathname()
  const strategy = params.get('strategy') ?? 'TAX_LIEN'
  const href = `/dashboard/deals?strategy=${strategy}`
  const isActive = pathname.startsWith('/dashboard/deals')

  return (
    <Link
      href={href}
      className={`${className} ${isActive ? 'text-zinc-900 bg-zinc-100' : ''}`}
    >
      Deals
    </Link>
  )
}
