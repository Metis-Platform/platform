'use client'

import { useCallback, useMemo } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import Link from 'next/link'

type JurisdictionRow = {
  id: string
  state: string
  stateName: string
  county: string
  investmentType: string
  isAvailable: boolean
  activeRuleSet: { id: string; name: string; ruleCount: number } | null
  totalRuleSets: number
  opportunityScore: number | null
  saturationScore: number | null
}

const INVESTMENT_LABELS: Record<string, string> = {
  LIEN: 'Lien',
  DEED: 'Deed',
  REDEEMABLE_DEED: 'Red. Deed',
}

type SortCol = 'state' | 'county' | 'available' | 'rules' | 'opportunity' | 'saturation'
type FilterMode = 'all' | 'available' | 'unavailable' | 'missing'

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) return <span className="ml-1 text-zinc-300">↕</span>
  return <span className="ml-1 text-zinc-700">{dir === 'asc' ? '↑' : '↓'}</span>
}

function ScoreBadge({ score, tone }: { score: number | null; tone: 'opportunity' | 'saturation' }) {
  if (score === null) return <span className="text-zinc-300">—</span>

  const color =
    tone === 'opportunity'
      ? score >= 70 ? 'bg-emerald-50 text-emerald-700' : score >= 40 ? 'bg-amber-50 text-amber-700' : 'bg-zinc-100 text-zinc-500'
      : score >= 70 ? 'bg-red-50 text-red-700' : score >= 40 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'

  return (
    <span className={`inline-flex min-w-10 justify-center rounded-full px-2 py-0.5 text-xs font-semibold ${color}`}>
      {score}
    </span>
  )
}

export default function JurisdictionSearch({ jurisdictions }: { jurisdictions: JurisdictionRow[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const sortCol = (searchParams.get('sort') as SortCol) ?? 'state'
  const sortDir = (searchParams.get('dir') as 'asc' | 'desc') ?? 'asc'
  const filterMode = (searchParams.get('filter') as FilterMode) ?? 'all'
  const stateFilter = searchParams.get('state') ?? ''
  const query = searchParams.get('q') ?? ''

  const updateParams = useCallback((updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString())
    for (const [k, v] of Object.entries(updates)) {
      if (v) params.set(k, v)
      else params.delete(k)
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }, [searchParams, router, pathname])

  function toggleSort(col: SortCol) {
    if (col === sortCol) {
      updateParams({ sort: col, dir: sortDir === 'asc' ? 'desc' : 'asc' })
    } else {
      updateParams({ sort: col, dir: 'asc' })
    }
  }

  const uniqueStates = useMemo(
    () => [...new Set(jurisdictions.map((j) => j.state))].sort(),
    [jurisdictions]
  )

  const filtered = useMemo(() => {
    let rows = jurisdictions.filter((j) => {
      const matchQuery = !query || `${j.state} ${j.stateName} ${j.county}`.toLowerCase().includes(query.toLowerCase())
      const matchState = !stateFilter || j.state === stateFilter
      const matchFilter =
        filterMode === 'all'         ? true
        : filterMode === 'available' ? j.isAvailable
        : filterMode === 'unavailable' ? !j.isAvailable
        : /* missing */                !j.activeRuleSet
      return matchQuery && matchState && matchFilter
    })

    rows = [...rows].sort((a, b) => {
      let cmp = 0
      if (sortCol === 'state')     cmp = a.state.localeCompare(b.state) || a.county.localeCompare(b.county)
      if (sortCol === 'county')    cmp = a.county.localeCompare(b.county)
      if (sortCol === 'available') cmp = (b.isAvailable ? 1 : 0) - (a.isAvailable ? 1 : 0)
      if (sortCol === 'rules')     cmp = (b.activeRuleSet?.ruleCount ?? 0) - (a.activeRuleSet?.ruleCount ?? 0)
      if (sortCol === 'opportunity') cmp = (b.opportunityScore ?? -1) - (a.opportunityScore ?? -1)
      if (sortCol === 'saturation')  cmp = (b.saturationScore ?? -1) - (a.saturationScore ?? -1)
      return sortDir === 'asc' ? cmp : -cmp
    })

    return rows
  }, [jurisdictions, query, stateFilter, filterMode, sortCol, sortDir])

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search state or county…"
          value={query}
          onChange={(e) => updateParams({ q: e.target.value })}
          className="block w-56 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none"
        />

        <select
          value={stateFilter}
          onChange={(e) => updateParams({ state: e.target.value })}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none"
        >
          <option value="">All states</option>
          {uniqueStates.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <div className="flex items-center rounded-lg border border-zinc-200 bg-white p-1 shadow-sm">
          {([
            ['all',         'All'],
            ['available',   'Available'],
            ['unavailable', 'Unavailable'],
            ['missing',     'No Rules'],
          ] as [FilterMode, string][]).map(([mode, label]) => (
            <button
              key={mode}
              onClick={() => updateParams({ filter: mode === 'all' ? '' : mode })}
              className={`rounded-md px-3 py-1 text-sm transition-colors ${
                filterMode === mode ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <span className="text-sm text-zinc-400">{filtered.length} shown</span>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50">
              {([
                ['state',     'State',    'text-left'],
                ['county',    'County',   'text-left'],
                [null,        'Type',     'text-left'],
                [null,        'Coverage', 'text-left'],
                ['rules',     'Rules',    'text-left'],
                ['opportunity', 'Opp.',   'text-left'],
                ['saturation',  'Sat.',   'text-left'],
                ['available', 'Status',   'text-left'],
                [null,        '',         'text-right'],
              ] as [SortCol | null, string, string][]).map(([col, label, align], i) => (
                <th key={i} className={`px-4 py-3 ${align} text-xs font-semibold uppercase tracking-wide text-zinc-500`}>
                  {col ? (
                    <button
                      onClick={() => toggleSort(col)}
                      className="flex items-center gap-0.5 hover:text-zinc-800 transition-colors"
                    >
                      {label}
                      <SortIcon active={sortCol === col} dir={sortDir} />
                    </button>
                  ) : label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-sm text-zinc-400">
                  No jurisdictions match your search.
                </td>
              </tr>
            )}
            {filtered.map((j) => (
              <tr key={j.id} className="hover:bg-zinc-50">
                <td className="px-4 py-3 font-medium text-zinc-900">{j.state}</td>
                <td className="px-4 py-3 text-zinc-700">{j.county}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                    {INVESTMENT_LABELS[j.investmentType] ?? j.investmentType}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium ${j.activeRuleSet ? 'text-emerald-600' : 'text-zinc-300'}`}>
                    TAX LIEN {j.activeRuleSet ? '✓' : '—'}
                  </span>
                </td>
                <td className="px-4 py-3 text-zinc-500">
                  {j.activeRuleSet
                    ? `${j.activeRuleSet.ruleCount} rule${j.activeRuleSet.ruleCount === 1 ? '' : 's'}`
                    : j.totalRuleSets > 0
                      ? `${j.totalRuleSets} inactive`
                      : '—'}
                </td>
                <td className="px-4 py-3"><ScoreBadge score={j.opportunityScore} tone="opportunity" /></td>
                <td className="px-4 py-3"><ScoreBadge score={j.saturationScore} tone="saturation" /></td>
                <td className="px-4 py-3">
                  {j.isAvailable ? (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                      ✓ Available
                    </span>
                  ) : (
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-400">
                      Unavailable
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/rules/${j.id}`}
                    className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    Manage →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
