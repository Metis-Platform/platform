'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import ExitResultCard from './ExitResultCard'
import type { ExitResult, InvestorConstraints, StrategyType } from '@/lib/exit-engine/types'

type ExitOptionsResponse = {
  results: ExitResult[]
  parcelCompleteness: number
  parcelLastUpdated: string
  cached?: boolean
  researchRequest?: {
    id: string
    status: string
    priority: string
    requestedAt: string
    completedAt: string | null
  } | null
}

type InvestorProfileResponse = {
  profile: {
    maxPurchasePrice: number | null
    improvementCapital: number | null
    holdMonthsTolerance: number | null
    targetRoi: number | null
    financing: InvestorConstraints['financing']
    licenseTypes: string[]
  } | null
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
  const [saveDefaults, setSaveDefaults] = useState(false)
  const [showResearchModal, setShowResearchModal] = useState(false)
  const [researchMessage, setResearchMessage] = useState<string | null>(null)
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

  const load = useCallback((force = false) => {
    startTransition(async () => {
      if (saveDefaults) await saveInvestorProfile(constraints)
      const response = await fetch(`/api/deals/${dealId}/exit-options?${query}${force ? '&force=true' : ''}`, { cache: 'no-store' })
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null
        setError(body?.error ?? 'Exit analysis is unavailable.')
        setData(null)
        return
      }
      setError(null)
      setData(await response.json() as ExitOptionsResponse)
    })
  }, [constraints, dealId, query, saveDefaults])

  useEffect(() => {
    let cancelled = false
    async function loadProfile() {
      const response = await fetch('/api/tenants/investor-profile', { cache: 'no-store' })
      if (!response.ok) return
      const body = await response.json() as InvestorProfileResponse
      if (cancelled || !body.profile) return
      setConstraints(current => ({
        ...current,
        maxPurchasePrice: body.profile?.maxPurchasePrice ?? current.maxPurchasePrice,
        improvementCapital: body.profile?.improvementCapital ?? current.improvementCapital,
        holdMonthsTolerance: body.profile?.holdMonthsTolerance ?? current.holdMonthsTolerance,
        targetRoi: body.profile?.targetRoi ?? current.targetRoi,
        financing: body.profile?.financing ?? current.financing,
        licenseTypes: body.profile?.licenseTypes ?? current.licenseTypes,
      }))
    }
    void loadProfile()
    return () => {
      cancelled = true
    }
  }, [])

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

  function requestResearch(priority: 'STANDARD' | 'RUSH') {
    setResearchMessage(null)
    startTransition(async () => {
      const response = await fetch('/api/parcels/research-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId, priority }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null
        setResearchMessage(body?.error ?? 'Parcel research request failed.')
        return
      }
      setShowResearchModal(false)
      setResearchMessage('Parcel research request submitted.')
      load(true)
    })
  }

  const showResearchButton = data && data.parcelCompleteness < 0.5 && !data.researchRequest

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
        <button
          type="button"
          onClick={() => load(true)}
          disabled={isPending}
          className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
        >
          Re-run Analysis
        </button>
        {showResearchButton && (
          <button
            type="button"
            onClick={() => setShowResearchModal(true)}
            className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100"
          >
            Request Parcel Research
          </button>
        )}
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

      <label className="mb-4 flex items-center gap-2 text-xs font-medium text-zinc-600">
        <input
          type="checkbox"
          checked={saveDefaults}
          onChange={event => setSaveDefaults(event.target.checked)}
          className="h-4 w-4 rounded border-zinc-300"
        />
        Save these investor constraints as my tenant defaults when analysis runs
      </label>

      <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
        {data && (
          <>
            <span>Parcel completeness {Math.round(data.parcelCompleteness * 100)}%</span>
            <span>Updated {new Date(data.parcelLastUpdated).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            {data.cached && <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-medium text-zinc-600">Cached</span>}
          </>
        )}
        {enrichMessage && <span className={enrichMessage.includes('failed') ? 'text-red-600' : 'text-emerald-700'}>{enrichMessage}</span>}
        {researchMessage && <span className={researchMessage.includes('failed') ? 'text-red-600' : 'text-emerald-700'}>{researchMessage}</span>}
        {data?.researchRequest && (
          <span className="rounded-full bg-blue-50 px-2 py-0.5 font-medium text-blue-700">
            Research {data.researchRequest.status.toLowerCase().replaceAll('_', ' ')}
            {' '}since {new Date(data.researchRequest.requestedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        )}
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

      {showResearchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-zinc-900">Parcel Research Service</h3>
              <p className="mt-2 text-sm text-zinc-500">
                We will manually research lien status, utility availability, HOA, permit history, title issues, and environmental gaps. Standard turnaround is 2 business days.
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-600">
              Current parcel completeness: {data ? Math.round(data.parcelCompleteness * 100) : 0}%
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowResearchModal(false)}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => requestResearch('STANDARD')}
                disabled={isPending}
                className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
              >
                Request Research
              </button>
            </div>
          </div>
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

async function saveInvestorProfile(constraints: InvestorConstraints) {
  await fetch('/api/tenants/investor-profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      maxPurchasePrice: constraints.maxPurchasePrice,
      improvementCapital: constraints.improvementCapital,
      holdMonthsTolerance: constraints.holdMonthsTolerance,
      targetRoi: constraints.targetRoi,
      financing: constraints.financing,
      licenseTypes: constraints.licenseTypes ?? [],
    }),
  })
}

function strategyLabel(strategy: StrategyType) {
  return strategy.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, char => char.toUpperCase())
}
