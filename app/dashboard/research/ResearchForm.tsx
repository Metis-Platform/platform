'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { EXIT_META } from '@/lib/exit-engine/keys'
import type { ExitResult, ParcelProfile, Verdict } from '@/lib/exit-engine/types'
import type { MaoResult } from '@/lib/mao/calculator'

type Jurisdiction = {
  id: string
  fips: string
  state: string
  stateName: string
  county: string
}

type ResearchResponse = {
  parcel: ParcelProfile
  results: ExitResult[]
  mao: MaoResult[]
  jurisdiction: { id: string; state: string; county: string } | null
  enrich: { cacheHits: number; apiCalls: number; errors: Array<{ source: string; error: string }> }
}

type Props = { jurisdictions: Jurisdiction[] }

const VERDICT_CHIP: Record<Verdict, string> = {
  VIABLE:            'bg-emerald-100 text-emerald-700',
  CONDITIONAL:       'bg-amber-100 text-amber-700',
  NOT_VIABLE:        'bg-red-100 text-red-700',
  INSUFFICIENT_DATA: 'bg-zinc-100 text-zinc-600',
}

const VERDICT_BAR: Record<Verdict, string> = {
  VIABLE:            'bg-emerald-500',
  CONDITIONAL:       'bg-amber-500',
  NOT_VIABLE:        'bg-red-500',
  INSUFFICIENT_DATA: 'bg-zinc-300',
}

export default function ResearchForm({ jurisdictions }: Props) {
  const [apn,         setApn]         = useState('')
  const [fipsCounty,  setFipsCounty]  = useState('')
  const [countyQuery, setCountyQuery] = useState('')
  const [maxBid,      setMaxBid]      = useState('')
  const [showManual,  setShowManual]  = useState(false)

  // Manual overrides
  const [lotSqFt,          setLotSqFt]          = useState('')
  const [improved,         setImproved]          = useState<'true' | 'false' | ''>('')
  const [zoning,           setZoning]            = useState('')
  const [floodZone,        setFloodZone]         = useState('')
  const [assessedValue,    setAssessedValue]     = useState('')
  const [roadFrontage,     setRoadFrontage]      = useState<'' | 'paved' | 'unpaved' | 'easement_only' | 'landlocked'>('')
  const [wetlandsPresent,  setWetlandsPresent]   = useState<'true' | 'false' | ''>('')

  const [data,    setData]    = useState<ResearchResponse | null>(null)
  const [error,   setError]   = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const filteredJurisdictions = countyQuery.length >= 2
    ? jurisdictions.filter(j =>
        j.county.toLowerCase().includes(countyQuery.toLowerCase()) ||
        j.stateName.toLowerCase().includes(countyQuery.toLowerCase()) ||
        j.state.toLowerCase() === countyQuery.toLowerCase()
      ).slice(0, 20)
    : []

  function selectJurisdiction(j: Jurisdiction) {
    setFipsCounty(j.fips)
    setCountyQuery(`${j.county}, ${j.stateName}`)
    setFilteredOpen(false)
  }

  const [filteredOpen, setFilteredOpen] = useState(false)

  function analyze() {
    if (!apn || !fipsCounty) return
    setError(null)
    setData(null)
    startTransition(async () => {
      const overrides: Record<string, unknown> = {}
      if (lotSqFt)         overrides.lotSizeSqFt    = Number(lotSqFt)
      if (improved !== '') overrides.improved        = improved === 'true'
      if (zoning)          overrides.zoning          = zoning
      if (floodZone)       overrides.floodZone       = floodZone
      if (assessedValue)   overrides.assessedValue   = Number(assessedValue)
      if (roadFrontage)    overrides.roadFrontage    = roadFrontage
      if (wetlandsPresent !== '') overrides.wetlandsPresent = wetlandsPresent === 'true'

      const body: Record<string, unknown> = { apn, fipsCounty }
      if (maxBid)                       body.maxBid = Number(maxBid)
      if (Object.keys(overrides).length) body.overrides = overrides

      const res = await fetch('/api/parcels/pre-purchase-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const b = await res.json().catch(() => null) as { error?: string } | null
        setError(b?.error ?? 'Analysis failed. Please try again.')
        return
      }
      setData(await res.json() as ResearchResponse)
    })
  }

  const hasAnyCriticalBlockers = data?.results.some(r =>
    r.verdict === 'NOT_VIABLE' && r.blockers.length > 0
  )

  const viableExits = data?.results.filter(r => r.verdict === 'VIABLE') ?? []
  const notViableExits = data?.results.filter(r => r.verdict === 'NOT_VIABLE') ?? []
  const unbuildable = notViableExits.some(r => r.blockers.some(b =>
    b.toLowerCase().includes('unbuildable') ||
    b.toLowerCase().includes('minimum lot') ||
    b.toLowerCase().includes('flood zone') ||
    b.toLowerCase().includes('landlocked')
  ))

  const rawLandMao = data?.mao.find(m => m.strategy === 'LAND')
  const hasResidentialMao = data?.mao.some(m => m.strategy === 'FIX_FLIP' || m.strategy === 'BUY_HOLD')

  return (
    <div className="space-y-6">
      {/* Input form */}
      <section className="rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-zinc-900">Parcel Lookup</h2>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-zinc-500 mb-1">APN / Parcel ID</label>
            <input
              type="text"
              value={apn}
              onChange={e => setApn(e.target.value)}
              placeholder="e.g. 2340282 or 12-34-56-78-90"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">County</label>
            <div className="relative">
              <input
                type="text"
                value={countyQuery}
                onChange={e => { setCountyQuery(e.target.value); setFipsCounty(''); setFilteredOpen(true) }}
                onFocus={() => setFilteredOpen(true)}
                placeholder="Search county…"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
              {filteredOpen && filteredJurisdictions.length > 0 && (
                <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-lg text-sm">
                  {filteredJurisdictions.map(j => (
                    <li key={j.fips}>
                      <button
                        type="button"
                        onMouseDown={() => selectJurisdiction(j)}
                        className="w-full px-3 py-2 text-left text-zinc-800 hover:bg-zinc-50"
                      >
                        {j.county}, {j.stateName}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {fipsCounty && (
              <p className="mt-1 text-xs text-zinc-400">FIPS {fipsCounty}</p>
            )}
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Max Bid ($)</label>
            <input
              type="number"
              min="0"
              step="500"
              value={maxBid}
              onChange={e => setMaxBid(e.target.value)}
              placeholder="Your ceiling"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
            />
          </div>
        </div>

        {/* Manual data entry toggle */}
        <div className="mt-5 border-t border-zinc-100 pt-4">
          <button
            type="button"
            onClick={() => setShowManual(v => !v)}
            className="text-xs font-medium text-zinc-500 hover:text-zinc-800"
          >
            {showManual ? '▲ Hide' : '▼ Enter'} known parcel details (optional — improves analysis)
          </button>
          {showManual && (
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">Lot size (sq ft)</label>
                <input
                  type="number"
                  min="0"
                  value={lotSqFt}
                  onChange={e => setLotSqFt(e.target.value)}
                  placeholder="e.g. 7500"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">Improved?</label>
                <select
                  value={improved}
                  onChange={e => setImproved(e.target.value as '' | 'true' | 'false')}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
                >
                  <option value="">Unknown</option>
                  <option value="false">No — vacant lot</option>
                  <option value="true">Yes — structure present</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">Zoning code</label>
                <input
                  type="text"
                  value={zoning}
                  onChange={e => setZoning(e.target.value)}
                  placeholder="e.g. R-1"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">Flood zone</label>
                <input
                  type="text"
                  value={floodZone}
                  onChange={e => setFloodZone(e.target.value)}
                  placeholder="e.g. AE, X"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">Assessed value ($)</label>
                <input
                  type="number"
                  min="0"
                  value={assessedValue}
                  onChange={e => setAssessedValue(e.target.value)}
                  placeholder="From county records"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">Road frontage</label>
                <select
                  value={roadFrontage}
                  onChange={e => setRoadFrontage(e.target.value as '' | 'paved' | 'unpaved' | 'easement_only' | 'landlocked')}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
                >
                  <option value="">Unknown</option>
                  <option value="paved">Paved road</option>
                  <option value="unpaved">Unpaved road</option>
                  <option value="easement_only">Easement only</option>
                  <option value="landlocked">Landlocked</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">Wetlands present?</label>
                <select
                  value={wetlandsPresent}
                  onChange={e => setWetlandsPresent(e.target.value as '' | 'true' | 'false')}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
                >
                  <option value="">Unknown</option>
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              </div>
            </div>
          )}
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={analyze}
            disabled={isPending || !apn || !fipsCounty}
            className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-40"
          >
            {isPending ? 'Analyzing…' : 'Analyze Parcel'}
          </button>
          {data && (
            <span className="text-xs text-zinc-400">
              {data.enrich.apiCalls} source call{data.enrich.apiCalls !== 1 ? 's' : ''} · {data.enrich.cacheHits} cache hits
              {data.enrich.errors.length > 0 && (
                <span className="ml-2 text-amber-600">({data.enrich.errors.length} source error{data.enrich.errors.length !== 1 ? 's' : ''})</span>
              )}
            </span>
          )}
        </div>
        {error && (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
      </section>

      {/* Results */}
      {data && (
        <>
          {/* Alert banner for unbuildable / blocked parcels */}
          {(unbuildable || rawLandMao?.warning) && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4">
              <p className="text-sm font-semibold text-red-800">
                No viable residential exits — lot unbuildable
              </p>
              <p className="mt-1 text-xs text-red-600">
                This parcel has no path to residential development. Max bid should reflect raw land value only.
                {maxBid && rawLandMao?.scenario.moderate != null && Number(maxBid) > rawLandMao.scenario.moderate && (
                  <span className="ml-1 font-semibold">
                    Your max bid of {fmtCurrency(Number(maxBid))} is above the moderate raw land MAO of {fmtCurrency(rawLandMao.scenario.moderate)}.
                  </span>
                )}
              </p>
            </div>
          )}

          {/* Parcel summary */}
          <section className="rounded-xl border border-zinc-200 bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-900">Parcel Summary</h2>
              <span className="text-xs text-zinc-400">
                Data completeness {Math.round(data.parcel.dataCompleteness * 100)}%
              </span>
            </div>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
              <ParcelFact label="APN" value={data.parcel.apnRaw} />
              <ParcelFact label="County" value={data.jurisdiction ? `${data.jurisdiction.county}, ${data.jurisdiction.state}` : undefined} />
              <ParcelFact label="Improved" value={data.parcel.improved == null ? undefined : data.parcel.improved ? 'Yes' : 'No — vacant lot'} />
              <ParcelFact label="Lot size" value={data.parcel.lotSizeSqFt != null ? `${data.parcel.lotSizeSqFt.toLocaleString()} sq ft` : undefined} />
              <ParcelFact label="Zoning" value={data.parcel.zoning} />
              <ParcelFact label="Flood zone" value={data.parcel.floodZone} />
              <ParcelFact label="Road frontage" value={data.parcel.roadFrontage} />
              <ParcelFact label="Assessed value" value={data.parcel.assessedValue != null ? fmtCurrency(data.parcel.assessedValue) : undefined} />
              <ParcelFact label="Market estimate" value={data.parcel.marketValueEstimate != null ? fmtCurrency(data.parcel.marketValueEstimate) : undefined} />
              <ParcelFact label="Wetlands" value={data.parcel.wetlandsPresent == null ? undefined : data.parcel.wetlandsPresent ? 'Yes' : 'No'} />
            </dl>
            {data.parcel.dataCompleteness < 0.5 && (
              <p className="mt-4 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
                Parcel data is incomplete. Use the &quot;Enter known parcel details&quot; section above to add data you&apos;ve found
                on the county assessor website. Better data = more accurate exit analysis.
              </p>
            )}
          </section>

          {/* MAO Calculator */}
          {data.mao.length > 0 && (
            <section className="rounded-xl border border-zinc-200 bg-white p-6">
              <h2 className="mb-1 text-sm font-semibold text-zinc-900">Maximum Allowable Offer</h2>
              <p className="mb-4 text-xs text-zinc-500">
                Based on available parcel data. Conservative = protect profit. Aggressive = thin margin.
              </p>
              <div className="space-y-4">
                {data.mao.map(m => (
                  <div key={m.strategy} className={`rounded-lg border p-4 ${m.warning ? 'border-red-200 bg-red-50' : 'border-zinc-200 bg-zinc-50'}`}>
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-sm font-semibold text-zinc-900">{m.label}</span>
                      {m.warning && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                          Raw land only
                        </span>
                      )}
                    </div>
                    {m.warning && (
                      <p className="mb-3 text-xs font-medium text-red-700">{m.warning}</p>
                    )}
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <MaoTier label="Conservative" value={m.scenario.conservative} tone="green" />
                      <MaoTier label="Moderate" value={m.scenario.moderate} tone="amber" />
                      <MaoTier label="Aggressive" value={m.scenario.aggressive} tone="blue" />
                    </div>
                    <p className="mt-3 text-xs text-zinc-400">{m.basis}</p>
                    {maxBid && m.scenario.moderate != null && (
                      <div className={`mt-2 rounded px-3 py-2 text-xs font-medium ${
                        Number(maxBid) <= m.scenario.moderate
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {Number(maxBid) <= m.scenario.moderate
                          ? `Your max bid of ${fmtCurrency(Number(maxBid))} is within the moderate MAO`
                          : `Your max bid of ${fmtCurrency(Number(maxBid))} exceeds the moderate MAO by ${fmtCurrency(Number(maxBid) - m.scenario.moderate)}`}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {!hasResidentialMao && (
                <p className="mt-4 text-xs text-zinc-400">
                  Fix & Flip and Buy & Hold MAO require ARV / rent comps — not available from current parcel data.
                </p>
              )}
            </section>
          )}

          {/* Exit analysis */}
          <section className="rounded-xl border border-zinc-200 bg-white p-6">
            <div className="mb-4 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900">Exit Analysis</h2>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {viableExits.length} viable · {data.results.filter(r => r.verdict === 'CONDITIONAL').length} conditional · {notViableExits.length} blocked
                </p>
              </div>
              {hasAnyCriticalBlockers && (
                <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                  Critical blockers found
                </span>
              )}
            </div>

            {/* Viable exits first */}
            {viableExits.length > 0 && (
              <div className="mb-6">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Viable</p>
                <div className="grid gap-3 lg:grid-cols-2">
                  {viableExits.map(r => <ExitCard key={r.exitKey} result={r} />)}
                </div>
              </div>
            )}

            {/* Conditional */}
            {data.results.filter(r => r.verdict === 'CONDITIONAL').length > 0 && (
              <div className="mb-6">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Conditional</p>
                <div className="grid gap-3 lg:grid-cols-2">
                  {data.results.filter(r => r.verdict === 'CONDITIONAL').map(r => <ExitCard key={r.exitKey} result={r} />)}
                </div>
              </div>
            )}

            {/* Not viable — collapsed by default unless there are blockers */}
            {notViableExits.length > 0 && (
              <div className="mb-6">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  Not viable ({notViableExits.length})
                </p>
                <div className="grid gap-3 lg:grid-cols-2">
                  {notViableExits.map(r => <ExitCard key={r.exitKey} result={r} />)}
                </div>
              </div>
            )}

            {/* Insufficient data */}
            {data.results.filter(r => r.verdict === 'INSUFFICIENT_DATA').length > 0 && (
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  Insufficient data ({data.results.filter(r => r.verdict === 'INSUFFICIENT_DATA').length})
                </p>
                <div className="grid gap-3 lg:grid-cols-2">
                  {data.results.filter(r => r.verdict === 'INSUFFICIENT_DATA').map(r => <ExitCard key={r.exitKey} result={r} />)}
                </div>
              </div>
            )}
          </section>

          {/* Create deal CTA */}
          {data.jurisdiction && (
            <section className="rounded-xl border border-zinc-200 bg-white p-6">
              <h2 className="mb-1 text-sm font-semibold text-zinc-900">Win the auction?</h2>
              <p className="mb-4 text-xs text-zinc-500">
                If you bid and win, create a deal from this parcel to track it through closing and execution.
              </p>
              <Link
                href={`/dashboard/deals/new?jid=${data.jurisdiction.id}`}
                className="inline-flex rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
              >
                Create deal for this parcel
              </Link>
            </section>
          )}
        </>
      )}
    </div>
  )
}

function ExitCard({ result }: { result: ExitResult }) {
  const meta = EXIT_META[result.exitKey]
  const pct  = Math.round(result.confidence * 100)

  return (
    <article className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-zinc-900">{meta.label}</p>
          <p className="text-xs text-zinc-400">{meta.family}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${VERDICT_CHIP[result.verdict]}`}>
          {result.verdict.replaceAll('_', ' ')}
        </span>
      </div>

      {result.verdict !== 'INSUFFICIENT_DATA' && (
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-xs text-zinc-500">
            <span>Confidence</span>
            <span>{pct}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
            <div className={`h-full rounded-full ${VERDICT_BAR[result.verdict]}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {result.blockers.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs">
          {result.blockers.map(b => (
            <li key={b} className="flex gap-1.5 text-red-700">
              <span className="shrink-0 font-bold">×</span>{b}
            </li>
          ))}
        </ul>
      )}

      {result.conditions.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs">
          {result.conditions.map(c => (
            <li key={c} className="flex gap-1.5 text-amber-700">
              <span className="shrink-0 font-bold">!</span>{c}
            </li>
          ))}
        </ul>
      )}

      {result.dataGaps.length > 0 && result.verdict === 'INSUFFICIENT_DATA' && (
        <p className="mt-2 text-xs text-zinc-400">
          Needs: {result.dataGaps.map(g => g.label ?? g.field).join(', ')}
        </p>
      )}
    </article>
  )
}

function MaoTier({ label, value, tone }: { label: string; value: number | null; tone: 'green' | 'amber' | 'blue' }) {
  const colors = {
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50  text-amber-700',
    blue:  'bg-blue-50   text-blue-700',
  }
  return (
    <div className={`rounded-lg px-3 py-3 ${colors[tone]}`}>
      <p className="text-xs font-medium opacity-75">{label}</p>
      <p className="mt-1 text-lg font-bold">
        {value != null ? fmtCurrency(value) : '—'}
      </p>
    </div>
  )
}

function ParcelFact({ label, value }: { label: string; value: string | number | boolean | undefined }) {
  if (value == null) return null
  return (
    <div>
      <dt className="text-xs text-zinc-400">{label}</dt>
      <dd className="text-sm font-medium text-zinc-800">{String(value)}</dd>
    </div>
  )
}

function fmtCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
  return `$${Math.round(value).toLocaleString()}`
}
