'use client'

import { useState, useActionState } from 'react'
import { saveT12, type T12State } from '@/lib/actions/multifamily-t12'
import { computeT12Metrics, parseT12Csv, MONTHS, type T12Financials } from '@/lib/multifamily-schemas'

function fmt$(v: number) {
  return v < 0
    ? `(${Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 0 })})`
    : v.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

export default function T12Section({
  dealId,
  initialT12,
  proFormaNoi,
}: {
  dealId: string
  initialT12: T12Financials | null
  proFormaNoi: number | null
}) {
  const [showImport, setShowImport] = useState(false)
  const [csvText, setCsvText] = useState('')
  const [year, setYear] = useState(new Date().getFullYear() - 1)
  const [preview, setPreview] = useState<T12Financials | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)

  const boundAction = saveT12.bind(null, dealId)
  const [state, formAction, pending] = useActionState(boundAction, {} as T12State)

  const displayT12 = preview ?? initialT12
  const metrics = displayT12 ? computeT12Metrics(displayT12) : null

  function handleParse() {
    const parsed = parseT12Csv(csvText, year)
    if (!parsed) {
      setParseError('Could not parse. Expected: Category,Type,Jan,...,Dec')
      setPreview(null)
    } else {
      setParseError(null)
      setPreview(parsed)
    }
  }

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData()
    fd.set('csv', csvText)
    fd.set('year', year.toString())
    formAction(fd)
    setShowImport(false)
    setPreview(null)
    setCsvText('')
  }

  const incomeRows = displayT12?.rows.filter(r => r.type === 'INCOME') ?? []
  const expenseRows = displayT12?.rows.filter(r => r.type === 'EXPENSE') ?? []

  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-6 mt-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">
            T12 Financials
            {displayT12?.year ? <span className="ml-2 text-xs text-zinc-400 font-normal">{displayT12.year}</span> : null}
          </h2>
        </div>
        <button onClick={() => { setShowImport(v => !v); setPreview(null) }}
          className="text-xs text-zinc-500 hover:text-zinc-900 transition-colors">
          {showImport ? 'Cancel' : initialT12 ? 'Re-import' : 'Import CSV'}
        </button>
      </div>

      {state.error && (
        <div className="mb-4 text-sm text-red-700 bg-red-50 rounded-lg px-4 py-2">{state.error}</div>
      )}

      {/* CSV import panel */}
      {showImport && (
        <form onSubmit={handleSave} className="mb-6 space-y-3">
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-xs text-zinc-500 mb-2 font-medium">
              Paste CSV with header: <code className="bg-zinc-100 px-1 rounded">Category,Type,Jan,Feb,...,Dec</code>
            </p>
            <p className="text-xs text-zinc-400 mb-3">
              Type column: <code className="bg-zinc-100 px-1 rounded">INCOME</code> or <code className="bg-zinc-100 px-1 rounded">EXPENSE</code>. Omit Type column to default all rows to INCOME.
            </p>
            <div className="flex items-center gap-3 mb-3">
              <label className="text-xs text-zinc-500 whitespace-nowrap">Fiscal year:</label>
              <input type="number" value={year} onChange={e => setYear(parseInt(e.target.value) || year)}
                className="w-24 border border-zinc-200 rounded px-2 py-1 text-xs" />
            </div>
            <textarea
              value={csvText}
              onChange={e => { setCsvText(e.target.value); setPreview(null); setParseError(null) }}
              rows={8}
              placeholder={`Category,Type,Jan,Feb,Mar,Apr,May,Jun,Jul,Aug,Sep,Oct,Nov,Dec\nRent Income,INCOME,12500,12500,12500,...\nRepairs,EXPENSE,400,0,800,...`}
              className="w-full font-mono text-xs border border-zinc-200 rounded px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
            {parseError && <p className="text-xs text-red-600 mt-1">{parseError}</p>}
          </div>

          <div className="flex items-center gap-2">
            <button type="button" onClick={handleParse}
              disabled={!csvText.trim()}
              className="px-3 py-1.5 text-xs border border-zinc-300 rounded-lg text-zinc-700 hover:bg-zinc-50 disabled:opacity-40">
              Preview
            </button>
            {preview && (
              <button type="submit" disabled={pending}
                className="px-4 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {pending ? 'Saving…' : 'Save T12'}
              </button>
            )}
            {preview && (
              <span className="text-xs text-emerald-600 ml-1">
                {preview.rows.length} rows parsed — review below
              </span>
            )}
          </div>
        </form>
      )}

      {/* T12 table */}
      {displayT12 && metrics && (
        <>
          {/* Summary banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4 rounded-lg border border-zinc-100 bg-zinc-50 p-4">
            <div>
              <div className="text-xs text-zinc-500 mb-0.5">Annual Income</div>
              <div className="text-base font-bold text-emerald-700">${metrics.annualIncome.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-xs text-zinc-500 mb-0.5">Annual Expenses</div>
              <div className="text-base font-bold text-red-600">${metrics.annualExpenses.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-xs text-zinc-500 mb-0.5">T12 NOI</div>
              <div className={`text-base font-bold ${metrics.annualNoi >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                ${metrics.annualNoi.toLocaleString()}
              </div>
            </div>
            {proFormaNoi !== null && (
              <div>
                <div className="text-xs text-zinc-500 mb-0.5">vs Pro-Forma NOI</div>
                <div className={`text-base font-bold ${metrics.annualNoi >= proFormaNoi ? 'text-emerald-700' : 'text-amber-600'}`}>
                  {metrics.annualNoi >= proFormaNoi ? '+' : ''}
                  ${(metrics.annualNoi - proFormaNoi).toLocaleString()}
                </div>
              </div>
            )}
          </div>

          {/* Full grid */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-zinc-400 border-b border-zinc-100">
                  <th className="pb-2 pr-3 font-medium sticky left-0 bg-white min-w-36">Category</th>
                  {MONTHS.map(m => (
                    <th key={m} className="pb-2 pr-2 font-medium text-right min-w-14">{m}</th>
                  ))}
                  <th className="pb-2 pl-2 font-medium text-right min-w-16 border-l border-zinc-100">Total</th>
                </tr>
              </thead>
              <tbody>
                {incomeRows.length > 0 && (
                  <>
                    <tr>
                      <td colSpan={14} className="pt-3 pb-1 text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                        Income
                      </td>
                    </tr>
                    {incomeRows.map((row, i) => {
                      const total = row.values.reduce((a, b) => a + b, 0)
                      return (
                        <tr key={i} className="border-b border-zinc-50 hover:bg-zinc-50">
                          <td className="py-1.5 pr-3 sticky left-0 bg-white text-zinc-700 font-medium truncate max-w-36">{row.category}</td>
                          {row.values.map((v, j) => (
                            <td key={j} className="py-1.5 pr-2 text-right text-zinc-600">{v ? fmt$(v) : '—'}</td>
                          ))}
                          <td className="py-1.5 pl-2 text-right font-semibold text-zinc-800 border-l border-zinc-100">{fmt$(total)}</td>
                        </tr>
                      )
                    })}
                    <tr className="border-t border-zinc-200">
                      <td className="py-1.5 pr-3 font-semibold text-zinc-800 sticky left-0 bg-white">Total Income</td>
                      {Array.from({ length: 12 }, (_, i) => {
                        const v = incomeRows.reduce((s, r) => s + r.values[i], 0)
                        return <td key={i} className="py-1.5 pr-2 text-right font-semibold text-emerald-700">{fmt$(v)}</td>
                      })}
                      <td className="py-1.5 pl-2 text-right font-bold text-emerald-700 border-l border-zinc-100">{fmt$(metrics.annualIncome)}</td>
                    </tr>
                  </>
                )}

                {expenseRows.length > 0 && (
                  <>
                    <tr>
                      <td colSpan={14} className="pt-4 pb-1 text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                        Expenses
                      </td>
                    </tr>
                    {expenseRows.map((row, i) => {
                      const total = row.values.reduce((a, b) => a + b, 0)
                      return (
                        <tr key={i} className="border-b border-zinc-50 hover:bg-zinc-50">
                          <td className="py-1.5 pr-3 sticky left-0 bg-white text-zinc-700 font-medium truncate max-w-36">{row.category}</td>
                          {row.values.map((v, j) => (
                            <td key={j} className="py-1.5 pr-2 text-right text-zinc-600">{v ? fmt$(v) : '—'}</td>
                          ))}
                          <td className="py-1.5 pl-2 text-right font-semibold text-zinc-800 border-l border-zinc-100">{fmt$(total)}</td>
                        </tr>
                      )
                    })}
                    <tr className="border-t border-zinc-200">
                      <td className="py-1.5 pr-3 font-semibold text-zinc-800 sticky left-0 bg-white">Total Expenses</td>
                      {Array.from({ length: 12 }, (_, i) => {
                        const v = expenseRows.reduce((s, r) => s + r.values[i], 0)
                        return <td key={i} className="py-1.5 pr-2 text-right font-semibold text-red-600">{fmt$(v)}</td>
                      })}
                      <td className="py-1.5 pl-2 text-right font-bold text-red-600 border-l border-zinc-100">{fmt$(metrics.annualExpenses)}</td>
                    </tr>
                  </>
                )}

                {/* NOI row */}
                <tr className="border-t-2 border-zinc-300 bg-zinc-50">
                  <td className="py-2 pr-3 font-bold text-zinc-900 sticky left-0 bg-zinc-50">NOI</td>
                  {metrics.monthlyNoi.map((v, i) => (
                    <td key={i} className={`py-2 pr-2 text-right font-bold ${v >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                      {fmt$(v)}
                    </td>
                  ))}
                  <td className={`py-2 pl-2 text-right font-bold border-l border-zinc-200 ${metrics.annualNoi >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                    {fmt$(metrics.annualNoi)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      {!displayT12 && !showImport && (
        <div className="text-center py-8">
          <p className="text-sm text-zinc-400 mb-3">No T12 financials imported yet.</p>
          <button onClick={() => setShowImport(true)}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
            Import CSV
          </button>
        </div>
      )}
    </div>
  )
}
