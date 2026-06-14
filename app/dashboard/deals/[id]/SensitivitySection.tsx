'use client'

import { useState } from 'react'
import { computeGrid, DEFAULT_CAP_RATES, DEFAULT_HOLD_YEARS, type ScenarioInputs } from '@/lib/multifamily-scenarios'

type Props = {
  inputs: ScenarioInputs
}

function fmtM(v: number) {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`
  if (Math.abs(v) >= 1_000)     return `$${(v / 1_000).toFixed(0)}K`
  return `$${v.toFixed(0)}`
}

function fmtX(v: number | null) {
  if (v == null) return '—'
  return `${v.toFixed(2)}x`
}

function fmtPct(v: number) {
  return `${(v * 100).toFixed(1)}%`
}

function cellColor(em: number | null) {
  if (em == null) return 'bg-zinc-50'
  if (em >= 2.0)  return 'bg-emerald-100'
  if (em >= 1.5)  return 'bg-emerald-50'
  if (em >= 1.0)  return 'bg-yellow-50'
  return 'bg-red-50'
}

export default function SensitivitySection({ inputs }: Props) {
  const [noiGrowthPct, setNoiGrowthPct] = useState(0.03)
  const [view, setView] = useState<'exitValue' | 'equityMultiple'>('equityMultiple')

  const grid = computeGrid(inputs, DEFAULT_CAP_RATES, DEFAULT_HOLD_YEARS, noiGrowthPct)

  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Sensitivity Analysis</h2>
          <p className="text-xs text-zinc-400 mt-0.5">Exit cap rate × hold period — assumes interest-only balloon</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-zinc-500">NOI growth/yr</label>
            <input
              type="number"
              min={-0.05}
              max={0.15}
              step={0.005}
              value={(noiGrowthPct * 100).toFixed(1)}
              onChange={e => setNoiGrowthPct(parseFloat(e.target.value) / 100 || 0)}
              className="w-16 text-xs border border-zinc-200 rounded px-2 py-1 text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-xs text-zinc-400">%</span>
          </div>
          <div className="flex rounded-lg border border-zinc-200 overflow-hidden text-xs">
            <button
              onClick={() => setView('equityMultiple')}
              className={`px-2 py-1 ${view === 'equityMultiple' ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-50'}`}
            >
              Equity ×
            </button>
            <button
              onClick={() => setView('exitValue')}
              className={`px-2 py-1 ${view === 'exitValue' ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-50'}`}
            >
              Exit Value
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="text-left font-medium text-zinc-400 pb-2 pr-3 whitespace-nowrap">Exit Cap ↓ / Hold →</th>
              {DEFAULT_HOLD_YEARS.map(y => (
                <th key={y} className="text-center font-medium text-zinc-500 pb-2 px-2 whitespace-nowrap">{y} yr</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DEFAULT_CAP_RATES.map((cap, rowIdx) => (
              <tr key={cap} className="border-t border-zinc-50">
                <td className="py-1.5 pr-3 font-medium text-zinc-500 whitespace-nowrap">{fmtPct(cap)}</td>
                {DEFAULT_HOLD_YEARS.map((_, colIdx) => {
                  const s = grid[rowIdx][colIdx]
                  const em = s.equityMultiple
                  return (
                    <td key={colIdx} className={`py-1.5 px-2 text-center rounded ${cellColor(em)}`}>
                      <div className="font-semibold text-zinc-800">
                        {view === 'equityMultiple' ? fmtX(em) : fmtM(s.exitValue)}
                      </div>
                      {view === 'equityMultiple' && (
                        <div className="text-[10px] text-zinc-400">{fmtM(s.exitValue)}</div>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex gap-4 text-[11px] text-zinc-400">
        <span>Base NOI: <strong className="text-zinc-600">${inputs.baseNOI.toLocaleString('en-US', { maximumFractionDigits: 0 })}</strong></span>
        <span>Purchase: <strong className="text-zinc-600">${inputs.purchasePrice.toLocaleString('en-US', { maximumFractionDigits: 0 })}</strong></span>
        <span>Loan: <strong className="text-zinc-600">${inputs.loanAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })}</strong></span>
        <span>Initial Equity: <strong className="text-zinc-600">${Math.max(inputs.purchasePrice - inputs.loanAmount, 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}</strong></span>
      </div>

      <div className="mt-1.5 flex items-center gap-3 text-[10px] text-zinc-400">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-100 inline-block" /> ≥2.0× great</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-50 inline-block" /> ≥1.5× good</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-yellow-50 inline-block" /> ≥1.0× ok</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-50 inline-block" /> &lt;1.0× loss</span>
      </div>
    </div>
  )
}
