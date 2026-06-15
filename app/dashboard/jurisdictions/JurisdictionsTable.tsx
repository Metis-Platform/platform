'use client'

import { useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { STATE_INFO, getStateInfo, investmentTypeBadgeClass } from '@/lib/state-info'

const USStateMap = dynamic(
  () => import('./USStateMap').then(m => m.USStateMap),
  { ssr: false, loading: () => <div className="h-64 rounded-xl border border-zinc-200 bg-zinc-50 animate-pulse" /> }
)

type JurisdictionRow = {
  id: string
  state: string
  stateName: string
  county: string
  investmentType: 'LIEN' | 'DEED' | 'REDEEMABLE_DEED'
  isAvailable: boolean
  ruleSets: { _count: { rules: number } }[]
}

const TYPE_LABELS: Record<string, string> = {
  LIEN: 'Tax Lien',
  DEED: 'Tax Deed',
  REDEEMABLE_DEED: 'Redeemable Deed',
}

const STRATEGIES = [
  { value: 'TAX_LIEN', label: 'Tax Lien' },
  { value: 'TAX_DEED', label: 'Tax Deed' },
  { value: 'FORECLOSURE', label: 'Foreclosure' },
  { value: 'LAND', label: 'Land' },
  { value: 'WHOLESALE', label: 'Wholesale' },
  { value: 'FIX_FLIP', label: 'Fix & Flip' },
  { value: 'BUY_HOLD', label: 'Buy & Hold' },
  { value: 'MULTIFAMILY', label: 'Multifamily' },
]

export function JurisdictionsTable({
  counties,
  selectedState,
}: {
  counties: JurisdictionRow[]
  selectedState: string
}) {
  const router = useRouter()
  const [search, setSearch] = useState('')

  function handleStateClick(abbr: string) {
    setSearch('')
    const next = abbr === selectedState ? '' : abbr
    router.push(next ? `/dashboard/jurisdictions?state=${next}` : '/dashboard/jurisdictions')
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return counties
    return counties.filter(j => j.county.toLowerCase().includes(q))
  }, [counties, search])

  const selectedInfo = selectedState ? STATE_INFO[selectedState] : null

  return (
    <div className="space-y-4">
      {/* Geographic map — lazy-loaded, uses only static state-info data, no DB */}
      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
        <USStateMap
          selectedState={selectedState}
          onStateClick={handleStateClick}
        />
      </div>

      {selectedState ? (
        <>
          {/* State summary + search */}
          <div className="flex items-center gap-4 rounded-lg border border-zinc-200 bg-white px-4 py-3">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-zinc-900 truncate">{selectedInfo?.stateName ?? selectedState}</p>
              {selectedInfo && (
                <p className="text-sm text-zinc-500 truncate">
                  {selectedInfo.investmentLabel}
                  {selectedInfo.interestRate && ` · ${selectedInfo.interestRate}`}
                  {selectedInfo.redemptionPeriod && ` · ${selectedInfo.redemptionPeriod} redemption`}
                </p>
              )}
            </div>
            <input
              type="search"
              placeholder="Search counties…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input-base w-44"
            />
            <span className="text-sm text-zinc-400 whitespace-nowrap">
              {filtered.length} of {counties.length} counties
            </span>
            <button
              type="button"
              onClick={() => router.push('/dashboard/jurisdictions')}
              className="text-sm text-zinc-400 hover:text-zinc-700 transition-colors"
            >
              Clear ×
            </button>
          </div>

          <div className="rounded-xl border border-zinc-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200">
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">County</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">Interest Rate</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">Redemption</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">Rules</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wide">New Deal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filtered.map(j => {
                  const stateInfo = getStateInfo(j.state)
                  const activeRuleSet = j.ruleSets[0] ?? null
                  return (
                    <tr key={j.id} className="hover:bg-zinc-50 transition-colors">
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashboard/jurisdictions/${j.id}`}
                          className="font-medium text-zinc-900 hover:text-blue-700 transition-colors"
                        >
                          {j.county} County
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${investmentTypeBadgeClass(stateInfo?.investmentType ?? 'NOT_ACTIVE')}`}>
                          {stateInfo?.investmentLabel ?? TYPE_LABELS[j.investmentType] ?? j.investmentType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-600">{stateInfo?.interestRate ?? '—'}</td>
                      <td className="px-4 py-3 text-zinc-600">{stateInfo?.redemptionPeriod ?? '—'}</td>
                      <td className="px-4 py-3">
                        {activeRuleSet
                          ? <span className="font-medium text-blue-700">{activeRuleSet._count.rules} rules</span>
                          : <span className="text-xs text-amber-600">Pending</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-right">
                        <details className="relative inline-block text-left">
                          <summary className="inline-flex cursor-pointer select-none list-none items-center gap-1 rounded-md bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors">
                            New Deal
                            <svg className="h-3 w-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                          </summary>
                          <div className="absolute right-0 z-10 mt-1 w-40 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
                            {STRATEGIES.map(s => (
                              <Link
                                key={s.value}
                                href={`/dashboard/deals/new?strategy=${s.value}&jid=${j.id}`}
                                className="block px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50 transition-colors"
                              >
                                {s.label}
                              </Link>
                            ))}
                          </div>
                        </details>
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-zinc-400">
                      No counties match your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-zinc-200 bg-white px-6 py-12 text-center text-sm text-zinc-400">
          Select a state on the map to browse its counties.
        </div>
      )}
    </div>
  )
}
