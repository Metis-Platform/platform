'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { getStateInfo, investmentTypeBadgeClass } from '@/lib/state-info'

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

const TYPE_FILTERS = [
  { value: '', label: 'All' },
  { value: 'LIEN', label: 'Tax Lien' },
  { value: 'DEED', label: 'Tax Deed' },
  { value: 'REDEEMABLE_DEED', label: 'Redeemable' },
]

// Tile grid layout: [col, row] positions, 12 cols × 9 rows
// Roughly geographic — standard data-viz tile grid for US states
const STATE_GRID: { abbr: string; col: number; row: number }[] = [
  { abbr: 'ME', col: 11, row: 0 },
  { abbr: 'VT', col: 10, row: 1 }, { abbr: 'NH', col: 11, row: 1 },
  { abbr: 'WA', col: 0, row: 2 }, { abbr: 'MT', col: 1, row: 2 }, { abbr: 'ND', col: 2, row: 2 },
  { abbr: 'MN', col: 3, row: 2 }, { abbr: 'MI', col: 6, row: 2 }, { abbr: 'NY', col: 8, row: 2 },
  { abbr: 'MA', col: 11, row: 2 },
  { abbr: 'OR', col: 0, row: 3 }, { abbr: 'ID', col: 1, row: 3 }, { abbr: 'WY', col: 2, row: 3 },
  { abbr: 'SD', col: 3, row: 3 }, { abbr: 'WI', col: 4, row: 3 }, { abbr: 'IN', col: 6, row: 3 },
  { abbr: 'OH', col: 7, row: 3 }, { abbr: 'PA', col: 8, row: 3 }, { abbr: 'NJ', col: 9, row: 3 },
  { abbr: 'CT', col: 10, row: 3 }, { abbr: 'RI', col: 11, row: 3 },
  { abbr: 'CA', col: 0, row: 4 }, { abbr: 'NV', col: 1, row: 4 }, { abbr: 'UT', col: 2, row: 4 },
  { abbr: 'CO', col: 3, row: 4 }, { abbr: 'NE', col: 4, row: 4 }, { abbr: 'IA', col: 5, row: 4 },
  { abbr: 'IL', col: 6, row: 4 }, { abbr: 'KY', col: 7, row: 4 }, { abbr: 'WV', col: 8, row: 4 },
  { abbr: 'VA', col: 9, row: 4 }, { abbr: 'MD', col: 10, row: 4 }, { abbr: 'DE', col: 11, row: 4 },
  { abbr: 'AZ', col: 2, row: 5 }, { abbr: 'NM', col: 3, row: 5 }, { abbr: 'KS', col: 4, row: 5 },
  { abbr: 'MO', col: 5, row: 5 }, { abbr: 'TN', col: 7, row: 5 }, { abbr: 'NC', col: 8, row: 5 },
  { abbr: 'SC', col: 9, row: 5 },
  { abbr: 'OK', col: 4, row: 6 }, { abbr: 'AR', col: 5, row: 6 }, { abbr: 'MS', col: 6, row: 6 },
  { abbr: 'AL', col: 7, row: 6 }, { abbr: 'GA', col: 8, row: 6 },
  { abbr: 'HI', col: 1, row: 7 }, { abbr: 'TX', col: 4, row: 7 }, { abbr: 'LA', col: 5, row: 7 },
  { abbr: 'FL', col: 8, row: 7 },
  { abbr: 'AK', col: 0, row: 8 },
]

function StateMapCell({
  abbr,
  investmentType,
  countyCount,
  selected,
  onClick,
}: {
  abbr: string
  investmentType: string
  countyCount: number
  selected: boolean
  onClick: () => void
}) {
  const bgClass =
    investmentType === 'TAX_LIEN' ? 'bg-blue-100 hover:bg-blue-200 text-blue-800' :
    investmentType === 'TAX_DEED' ? 'bg-purple-100 hover:bg-purple-200 text-purple-800' :
    investmentType === 'REDEEMABLE_DEED' ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800' :
    'bg-zinc-100 hover:bg-zinc-200 text-zinc-500'

  return (
    <button
      type="button"
      onClick={onClick}
      title={`${abbr} — ${countyCount} counties`}
      className={`flex items-center justify-center rounded text-xs font-bold transition-all ${bgClass} ${
        selected ? 'ring-2 ring-offset-1 ring-zinc-800 scale-110' : ''
      }`}
      style={{ gridColumn: undefined, gridRow: undefined }}
    >
      {abbr}
    </button>
  )
}

export function JurisdictionsTable({ jurisdictions }: { jurisdictions: JurisdictionRow[] }) {
  const [stateFilter, setStateFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [search, setSearch] = useState('')

  // Per-state investment type (from state-info) and county counts for the map
  const stateStats = useMemo(() => {
    const map = new Map<string, { investmentType: string; count: number }>()
    for (const j of jurisdictions) {
      const existing = map.get(j.state)
      if (existing) {
        existing.count++
      } else {
        const si = getStateInfo(j.state)
        map.set(j.state, { investmentType: si?.investmentType ?? 'NOT_ACTIVE', count: 1 })
      }
    }
    return map
  }, [jurisdictions])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return jurisdictions.filter(j => {
      if (stateFilter && j.state !== stateFilter) return false
      if (typeFilter && j.investmentType !== typeFilter) return false
      if (q && !j.county.toLowerCase().includes(q)) return false
      return true
    })
  }, [jurisdictions, stateFilter, typeFilter, search])

  function handleStateClick(abbr: string) {
    setStateFilter(prev => prev === abbr ? '' : abbr)
  }

  const COLS = 12
  const ROWS = 9

  return (
    <div className="space-y-4">
      {/* Tile grid map */}
      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Click a state to filter</p>
          <div className="flex items-center gap-3 text-xs text-zinc-400">
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-blue-100" /> Lien</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-purple-100" /> Deed</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-emerald-100" /> Redeemable</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-zinc-100" /> Not active</span>
          </div>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${COLS}, 1fr)`,
            gridTemplateRows: `repeat(${ROWS}, 28px)`,
            gap: '3px',
          }}
        >
          {STATE_GRID.map(({ abbr, col, row }) => {
            const stats = stateStats.get(abbr)
            return (
              <div
                key={abbr}
                style={{ gridColumn: col + 1, gridRow: row + 1 }}
              >
                <StateMapCell
                  abbr={abbr}
                  investmentType={stats?.investmentType ?? 'NOT_ACTIVE'}
                  countyCount={stats?.count ?? 0}
                  selected={stateFilter === abbr}
                  onClick={() => handleStateClick(abbr)}
                />
              </div>
            )
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Search counties…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input-base w-44"
        />
        <div className="flex rounded-lg border border-zinc-200 overflow-hidden text-sm">
          {TYPE_FILTERS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setTypeFilter(value)}
              className={`px-3 py-1.5 transition-colors ${
                typeFilter === value
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-zinc-600 hover:bg-zinc-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {stateFilter && (
          <button
            type="button"
            onClick={() => setStateFilter('')}
            className="flex items-center gap-1 rounded-full bg-zinc-900 pl-3 pr-2 py-1 text-xs font-medium text-white"
          >
            {stateFilter} <span className="ml-0.5 opacity-60">×</span>
          </button>
        )}
        <span className="ml-auto text-sm text-zinc-400">
          {filtered.length.toLocaleString()} of {jurisdictions.length.toLocaleString()} counties
        </span>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-zinc-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-200">
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">County</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">State</th>
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
                    <td className="px-4 py-3 text-zinc-500">{j.stateName}</td>
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
                  <td colSpan={7} className="px-4 py-10 text-center text-zinc-400">
                    No counties match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
