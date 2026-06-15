'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import ExitResultCard from './ExitResultCard'
import type { ExitResult, InvestorConstraints, StrategyType } from '@/lib/exit-engine/types'

type ExitOptionsResponse = {
  results: ExitResult[]
  parcelCompleteness: number
  parcelLastUpdated: string
}

type Props = {
  dealId: string
  strategyType: StrategyType
  defaultMaxPurchasePrice: number | null
}

const HOLD_OPTIONS = [0, 3, 6, 12, 24, 36]

export default function ExitOptionsPanel({ dealId, strategyType, defaultMaxPurchasePrice }: Props) {
  const [constraints, setConstraints] = useState<InvestorConstraints>({
    financing: 'CASH',
    maxPurchasePrice: defaultMaxPurchasePrice ?? undefined,
  })
  const [data, setData] = useState<ExitOptionsResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [enrichMessage, setEnrichMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const query = useMemo(() => {
    const params = new URLSearchParams()
    params.set('financing', constraints.financing)
    setNumberParam(params, 'maxPurchasePrice', constraints.maxPurchasePrice)
    setNumberParam(params, 'improvementCapital', constraints.improvementCapital)
    setNumberParam(params, 'holdMonthsTolerance', constraints.holdMonthsTolerance)
    setNumberParam(params, 'targetRoi', constraints.targetRoi == null ? undefined : constraints.targetRoi * 100)
    return params.toString()
  }, [constraints])

  const load = useCallback(() => {
    startTransition(async () => {
      const response = await fetch(`/api/deals/${dealId}/exit-options?${query}`, { cache: 'no-store' })
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null
        setError(body?.error ?? 'Exit analysis is unavailable.')
        setData(null)
        return
      }
      setError(null)
      setData(await response.json() as ExitOptionsResponse)
    })
  }, [dealId, query])

  useEffect(() => {
    load()
  }, [load])

  function updateNumber(key: keyof InvestorConstraints, value: string) {
    setConstraints(current => ({
      ...current,
      [key]: value === '' ? undefined : Number(value),
    }))
  }

  function enrichParcel() {
    setEnrichMessage(null)
    startTransition(async () => {
      const response = await fetch('/api/parcels/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null
        setEnrichMessage(body?.error ?? 'Parcel enrichment failed.')
        return
      }
      const body = await response.json() as { cacheHits?: number; apiCalls?: number }
      setEnrichMessage(`Parcel enrichment accepted: ${body.cacheHits ?? 0} cache hits, ${body.apiCalls ?? 0} source calls.`)
      load()
    })
  }

  return (
    <section className="mb-6 rounded-xl border border-zinc-200 bg-white p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Exit Options</h2>
          <p className="mt-1 text-xs text-zinc-500">
            {strategyLabel(strategyType)} strategy analysis from parcel, jurisdiction, and investor constraints.
          </p>
        </div>
        <button
          type="button"
          onClick={enrichParcel}
          disabled={isPending}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50"
        >
          {isPending ? 'Working…' : 'Enrich Parcel'}
        </button>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <NumberField label="Max purchase" value={constraints.maxPurchasePrice} onChange={value => updateNumber('maxPurchasePrice', value)} />
        <NumberField label="Improvement budget" value={constraints.improvementCapital} onChange={value => updateNumber('improvementCapital', value)} />
        <label className="block">
          <span className="text-xs font-medium text-zinc-500">Hold months</span>
          <select
            value={constraints.holdMonthsTolerance ?? ''}
            onChange={event => updateNumber('holdMonthsTolerance', event.target.value)}
            className="mt-1 h-9 w-full rounded-lg border border-zinc-300 bg-white px-2 text-sm text-zinc-900"
          >
            <option value="">Any</option>
            {HOLD_OPTIONS.map(months => <option key={months} value={months}>{months === 36 ? '36+' : months}</option>)}
          </select>
        </label>
        <NumberField label="Target ROI %" value={constraints.targetRoi == null ? undefined : constraints.targetRoi * 100} onChange={value => {
          setConstraints(current => ({ ...current, targetRoi: value === '' ? undefined : Number(value) / 100 }))
        }} />
        <label className="block">
          <span className="text-xs font-medium text-zinc-500">Financing</span>
          <select
            value={constraints.financing}
            onChange={event => setConstraints(current => ({ ...current, financing: event.target.value as InvestorConstraints['financing'] }))}
            className="mt-1 h-9 w-full rounded-lg border border-zinc-300 bg-white px-2 text-sm text-zinc-900"
          >
            <option value="CASH">Cash</option>
            <option value="LENDER">Lender</option>
          </select>
        </label>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
        {data && (
          <>
            <span>Parcel completeness {Math.round(data.parcelCompleteness * 100)}%</span>
            <span>Updated {new Date(data.parcelLastUpdated).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          </>
        )}
        {enrichMessage && <span className={enrichMessage.includes('failed') ? 'text-red-600' : 'text-emerald-700'}>{enrichMessage}</span>}
      </div>

      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {!error && !data && <p className="text-sm text-zinc-400">Loading exit analysis…</p>}
      {data && (
        <div className="grid gap-3 lg:grid-cols-2">
          {data.results.map(result => (
            <ExitResultCard key={result.exitKey} result={result} dealId={dealId} />
          ))}
        </div>
      )}
    </section>
  )
}

function NumberField({ label, value, onChange }: { label: string; value: number | undefined; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-zinc-500">{label}</span>
      <input
        type="number"
        min="0"
        value={value ?? ''}
        onChange={event => onChange(event.target.value)}
        className="mt-1 h-9 w-full rounded-lg border border-zinc-300 px-2 text-sm text-zinc-900"
      />
    </label>
  )
}

function setNumberParam(params: URLSearchParams, key: string, value: number | undefined) {
  if (value != null && Number.isFinite(value)) params.set(key, String(value))
}

function strategyLabel(strategy: StrategyType) {
  return strategy.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, char => char.toUpperCase())
}
