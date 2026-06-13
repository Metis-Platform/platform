'use client'

import { useState } from 'react'

type Props = {
  prefillAssignmentFee?: number | null
  prefillContractPrice?: number | null
}

export default function MaoCalculator({ prefillAssignmentFee, prefillContractPrice }: Props) {
  const [open, setOpen] = useState(false)
  const [arv, setArv]               = useState('')
  const [discount, setDiscount]     = useState('70')
  const [repairs, setRepairs]       = useState('')
  const [fee, setFee]               = useState(prefillAssignmentFee != null ? String(prefillAssignmentFee) : '')

  const arvNum      = parseFloat(arv)     || 0
  const discountNum = parseFloat(discount) / 100 || 0
  const repairsNum  = parseFloat(repairs) || 0
  const feeNum      = parseFloat(fee)     || 0

  const mao = arvNum > 0 ? arvNum * discountNum - repairsNum - feeNum : null

  const contractPriceNum = prefillContractPrice != null ? Number(prefillContractPrice) : null
  const vsContract = mao != null && contractPriceNum != null ? contractPriceNum - mao : null

  const profitMargin = arvNum > 0 && mao != null ? ((mao / arvNum) * 100) : null

  return (
    <div className="bg-white rounded-xl border border-zinc-200">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-zinc-50 transition-colors rounded-xl"
      >
        <span className="text-sm font-semibold text-zinc-900">MAO Calculator</span>
        <span className="text-zinc-400 text-xs">{open ? '▲ collapse' : '▼ expand'}</span>
      </button>

      {open && (
        <div className="px-6 pb-6 border-t border-zinc-100">
          <p className="text-xs text-zinc-500 mt-3 mb-4">
            MAO = (ARV × Discount%) − Repair Costs − Assignment Fee
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">ARV ($)</label>
              <input
                type="number" min="0" step="1000"
                value={arv}
                onChange={e => setArv(e.target.value)}
                placeholder="After repair value"
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Discount %</label>
              <input
                type="number" min="1" max="99" step="1"
                value={discount}
                onChange={e => setDiscount(e.target.value)}
                placeholder="70"
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Repair Costs ($)</label>
              <input
                type="number" min="0" step="500"
                value={repairs}
                onChange={e => setRepairs(e.target.value)}
                placeholder="0"
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Assignment Fee ($)</label>
              <input
                type="number" min="0" step="500"
                value={fee}
                onChange={e => setFee(e.target.value)}
                placeholder="0"
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
            </div>
          </div>

          {mao != null && (
            <div className="mt-5 rounded-lg bg-zinc-50 border border-zinc-200 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-zinc-700">MAO</span>
                <span className={`text-lg font-bold ${mao >= 0 ? 'text-zinc-900' : 'text-red-600'}`}>
                  ${mao.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
              </div>
              {profitMargin != null && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500">As % of ARV</span>
                  <span className="text-zinc-700">{profitMargin.toFixed(1)}%</span>
                </div>
              )}
              {vsContract != null && (
                <div className="flex items-center justify-between text-xs border-t border-zinc-200 pt-2 mt-2">
                  <span className="text-zinc-500">Contract price vs MAO</span>
                  <span className={vsContract <= 0 ? 'text-green-700 font-semibold' : 'text-red-600 font-semibold'}>
                    {vsContract <= 0
                      ? `Under by $${Math.abs(vsContract).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
                      : `Over by $${vsContract.toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
