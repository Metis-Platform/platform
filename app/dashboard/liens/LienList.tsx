'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'

export type LienRow = {
  id: string
  status: string          // LEAD | ACTIVE | REDEEMED | FORFEITED | etc.
  overdueCount: number
  apn: string
  address: string | null
  county: string
  state: string
  certificateNumber: string | null
  issueDate: string | null   // ISO string or null
  auctionDate: string | null // ISO string or null (leads)
  faceAmount: number | null
  nextDeadlineLabel: string | null
  nextDeadlineDays: number | null  // days from now (can be negative)
}

type SortKey = 'apn' | 'state' | 'amount' | 'date' | 'deadline'
type SortDir = 'asc' | 'desc'

const STATUS_OPTIONS = ['All', 'Active', 'Lead', 'Overdue'] as const

export default function LienList({ deals }: { deals: LienRow[] }) {
  const [search, setSearch]       = useState('')
  const [statusFilter, setStatus] = useState<string>('All')
  const [stateFilter, setState]   = useState<string>('All')
  const [sortKey, setSortKey]     = useState<SortKey>('deadline')
  const [sortDir, setSortDir]     = useState<SortDir>('asc')

  // Unique states present in the portfolio
  const states = useMemo(
    () => ['All', ...Array.from(new Set(deals.map(d => d.state))).sort()],
    [deals],
  )

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return deals.filter(d => {
      // Text search
      if (q && ![d.apn, d.address ?? '', d.certificateNumber ?? '', d.county].some(s => s.toLowerCase().includes(q))) return false
      // State
      if (stateFilter !== 'All' && d.state !== stateFilter) return false
      // Status
      if (statusFilter === 'Lead'    && d.status !== 'LEAD') return false
      if (statusFilter === 'Active'  && (d.status === 'LEAD' || d.overdueCount > 0)) return false
      if (statusFilter === 'Overdue' && d.overdueCount === 0) return false
      return true
    })
  }, [deals, search, statusFilter, stateFilter])

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case 'apn':      return dir * a.apn.localeCompare(b.apn)
        case 'state':    return dir * (`${a.state}${a.county}`).localeCompare(`${b.state}${b.county}`)
        case 'amount':   return dir * ((a.faceAmount ?? 0) - (b.faceAmount ?? 0))
        case 'date': {
          const aDate = a.status === 'LEAD' ? a.auctionDate : a.issueDate
          const bDate = b.status === 'LEAD' ? b.auctionDate : b.issueDate
          return dir * ((aDate ? new Date(aDate).getTime() : 0) - (bDate ? new Date(bDate).getTime() : 0))
        }
        case 'deadline': {
          const aDays = a.nextDeadlineDays ?? Infinity
          const bDays = b.nextDeadlineDays ?? Infinity
          return dir * (aDays - bDays)
        }
        default: return 0
      }
    })
  }, [filtered, sortKey, sortDir])

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <span className="ml-1 text-zinc-300">↕</span>
    return <span className="ml-1 text-blue-500">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  const active  = deals.filter(d => d.status !== 'LEAD').length
  const leads   = deals.filter(d => d.status === 'LEAD').length
  const overdue = deals.filter(d => d.overdueCount > 0).length

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Tax Liens</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {active} active · {leads} leads{overdue > 0 ? ` · ${overdue} overdue` : ''}
          </p>
        </div>
        <Link href="/dashboard/liens/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
          + New Lien
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Search */}
        <div className="relative flex-1 min-w-48 max-w-72">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search APN, cert #, address…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-sm border border-zinc-200 rounded-lg bg-white text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-1 bg-zinc-100 rounded-lg p-1">
          {STATUS_OPTIONS.map(s => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                statusFilter === s
                  ? 'bg-white text-zinc-900 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* State filter */}
        {states.length > 2 && (
          <select
            value={stateFilter}
            onChange={e => setState(e.target.value)}
            className="text-sm border border-zinc-200 rounded-lg px-3 py-1.5 bg-white text-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {states.map(s => (
              <option key={s} value={s}>{s === 'All' ? 'All states' : s}</option>
            ))}
          </select>
        )}

        {/* Result count */}
        {(search || statusFilter !== 'All' || stateFilter !== 'All') && (
          <span className="text-xs text-zinc-400 ml-auto">
            {sorted.length} of {deals.length}
            {(search || statusFilter !== 'All' || stateFilter !== 'All') && (
              <button
                onClick={() => { setSearch(''); setStatus('All'); setState('All') }}
                className="ml-2 text-blue-500 hover:underline"
              >
                Clear
              </button>
            )}
          </span>
        )}
      </div>

      {/* Table */}
      {sorted.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-zinc-200">
          <p className="text-zinc-400 text-sm">No liens match your filters.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                <th className="px-4 py-3 cursor-pointer hover:text-zinc-800 select-none" onClick={() => handleSort('apn')}>
                  Property / APN <SortIcon col="apn" />
                </th>
                <th className="px-4 py-3 cursor-pointer hover:text-zinc-800 select-none" onClick={() => handleSort('state')}>
                  Jurisdiction <SortIcon col="state" />
                </th>
                <th className="px-4 py-3">Certificate #</th>
                <th className="px-4 py-3 cursor-pointer hover:text-zinc-800 select-none" onClick={() => handleSort('date')}>
                  Date <SortIcon col="date" />
                </th>
                <th className="px-4 py-3 text-right cursor-pointer hover:text-zinc-800 select-none" onClick={() => handleSort('amount')}>
                  Amount <SortIcon col="amount" />
                </th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 cursor-pointer hover:text-zinc-800 select-none" onClick={() => handleSort('deadline')}>
                  Next Deadline <SortIcon col="deadline" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {sorted.map(deal => {
                const isLead = deal.status === 'LEAD'
                const date = isLead
                  ? (deal.auctionDate ? new Date(deal.auctionDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—')
                  : (deal.issueDate  ? new Date(deal.issueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })  : '—')
                const days = deal.nextDeadlineDays

                return (
                  <tr key={deal.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/liens/${deal.id}`} className="font-medium text-blue-600 hover:underline font-mono text-xs">
                        {deal.apn}
                      </Link>
                      {deal.address && <div className="text-xs text-zinc-400 truncate max-w-52 mt-0.5">{deal.address}</div>}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">{deal.county}, {deal.state}</td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-600">{deal.certificateNumber ?? '—'}</td>
                    <td className="px-4 py-3 text-zinc-600 text-xs">{date}</td>
                    <td className="px-4 py-3 text-right font-medium text-zinc-900">
                      {deal.faceAmount != null ? `$${deal.faceAmount.toLocaleString()}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {isLead ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">Lead</span>
                      ) : deal.overdueCount > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">{deal.overdueCount} overdue</span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Active</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {deal.nextDeadlineLabel ? (
                        <div>
                          <div className="text-zinc-700 truncate max-w-44 text-xs">{deal.nextDeadlineLabel}</div>
                          {days !== null && (
                            <div className={`text-xs font-medium mt-0.5 ${days < 0 ? 'text-red-500' : days <= 30 ? 'text-yellow-600' : 'text-zinc-400'}`}>
                              {days < 0 ? `${Math.abs(days)}d ago` : days === 0 ? 'Today' : `${days}d`}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-zinc-400 text-xs">{isLead ? 'Pending win' : '—'}</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
