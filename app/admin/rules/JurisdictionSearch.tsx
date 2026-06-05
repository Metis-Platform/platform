'use client'

import { useState } from 'react'
import Link from 'next/link'

type JurisdictionRow = {
  id: string
  state: string
  stateName: string
  county: string
  investmentType: string
  activeRuleSet: { id: string; name: string; ruleCount: number } | null
  totalRuleSets: number
}

const INVESTMENT_LABELS: Record<string, string> = {
  LIEN: 'Lien',
  DEED: 'Deed',
  REDEEMABLE_DEED: 'Red. Deed',
}

type FilterMode = 'all' | 'active' | 'missing'

export default function JurisdictionSearch({
  jurisdictions,
}: {
  jurisdictions: JurisdictionRow[]
}) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<FilterMode>('all')

  const filtered = jurisdictions.filter((j) => {
    const matchQuery =
      !query ||
      `${j.state} ${j.stateName} ${j.county}`
        .toLowerCase()
        .includes(query.toLowerCase())
    const matchFilter =
      filter === 'all'
        ? true
        : filter === 'active'
          ? !!j.activeRuleSet
          : !j.activeRuleSet
    return matchQuery && matchFilter
  })

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search state or county…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="block w-64 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none"
        />

        <div className="flex items-center rounded-lg border border-zinc-200 bg-white p-1 shadow-sm">
          {(
            [
              ['all', 'All'],
              ['active', 'Has Rules'],
              ['missing', 'No Rules'],
            ] as [FilterMode, string][]
          ).map(([mode, label]) => (
            <button
              key={mode}
              onClick={() => setFilter(mode)}
              className={`rounded-md px-3 py-1 text-sm transition-colors ${
                filter === mode
                  ? 'bg-zinc-900 text-white'
                  : 'text-zinc-600 hover:bg-zinc-100'
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
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                State
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                County
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Active Ruleset
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Rules
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-zinc-400">
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
                  {j.activeRuleSet ? (
                    <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                      {j.activeRuleSet.name}
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                      No active rules
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-zinc-500">
                  {j.activeRuleSet
                    ? `${j.activeRuleSet.ruleCount} rule${j.activeRuleSet.ruleCount === 1 ? '' : 's'}`
                    : j.totalRuleSets > 0
                      ? `${j.totalRuleSets} inactive`
                      : '—'}
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
