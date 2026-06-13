import { notFound, redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { syncUserToDatabase } from '@/lib/sync-user'
import { db } from '@/lib/db'
import { RentRollSchema, T12FinancialsSchema, BusinessPlanSchema, computeRentRollMetrics, computeT12Metrics, MONTHS } from '@/lib/multifamily-schemas'

export default async function MultifamilyPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { userId, orgId } = await auth()
  if (!userId || !orgId) redirect('/sign-in')

  const synced = await syncUserToDatabase()
  if (!synced) redirect('/onboarding')
  const { tenant } = synced

  const deal = await db.deal.findUnique({
    where: { id, tenantId: tenant.id },
    include: {
      property: { include: { jurisdiction: true } },
      multifamily: true,
    },
  })
  if (!deal || deal.strategyType !== 'MULTIFAMILY') notFound()

  const { multifamily, property } = deal
  const jur = property.jurisdiction
  const mfOpex = multifamily?.operatingExpenses as { total?: number } | null

  const rentRoll = multifamily?.rentRoll
    ? (() => { const r = RentRollSchema.safeParse(multifamily.rentRoll); return r.success ? r.data : null })()
    : null
  const t12 = multifamily?.t12Financials
    ? (() => { const r = T12FinancialsSchema.safeParse(multifamily.t12Financials); return r.success ? r.data : null })()
    : null
  const businessPlan = multifamily?.businessPlan
    ? (() => { const r = BusinessPlanSchema.safeParse(multifamily.businessPlan); return r.success ? r.data : null })()
    : null

  const rrMetrics = rentRoll ? computeRentRollMetrics(rentRoll) : null
  const t12Metrics = t12 ? computeT12Metrics(t12) : null

  function fmt$(v: number | null | undefined) {
    if (v == null) return '—'
    return `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  }
  function fmtPct(v: number | null | undefined, decimals = 1) {
    if (v == null) return '—'
    return `${(v * 100).toFixed(decimals)}%`
  }

  const purchasePrice = deal.purchasePrice ? Number(deal.purchasePrice) : null

  return (
    <div className="max-w-4xl mx-auto p-8 print:p-0">
      {/* Print button — hidden in print */}
      <div className="mb-6 print:hidden">
        <button onClick={() => window.print()}
          className="px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-lg hover:bg-zinc-700">
          Print / Save as PDF
        </button>
      </div>

      {/* Header */}
      <div className="mb-6 border-b border-zinc-200 pb-4">
        <div className="text-xs text-zinc-500 uppercase tracking-wide mb-1">
          Multifamily Investment Summary — {jur.county} County, {jur.state}
        </div>
        <h1 className="text-2xl font-bold text-zinc-900 font-mono">{property.apn}</h1>
        {property.address && <p className="text-sm text-zinc-600 mt-0.5">{property.address}</p>}
        <div className="text-xs text-zinc-400 mt-1">Generated {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
      </div>

      {/* Underwriting snapshot */}
      <section className="mb-6">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-3">Underwriting</h2>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-4 border border-zinc-100 rounded-lg p-4 bg-zinc-50">
          <Metric label="Purchase Price" value={fmt$(purchasePrice)} />
          <Metric label="Units" value={multifamily?.unitCount?.toString() ?? '—'} />
          <Metric label="GSI" value={fmt$(multifamily?.grossScheduledIncome ? Number(multifamily.grossScheduledIncome) : null)} />
          <Metric label="Annual Opex" value={fmt$(mfOpex?.total)} />
          <Metric label="NOI" value={fmt$(multifamily?.netOperatingIncome ? Number(multifamily.netOperatingIncome) : null)} />
          <Metric label="Cap Rate" value={fmtPct(multifamily?.capRate ? Number(multifamily.capRate) : null)} />
          <Metric label="Loan Amount" value={fmt$(multifamily?.loanAmount ? Number(multifamily.loanAmount) : null)} />
          <Metric label="Interest Rate" value={fmtPct(multifamily?.interestRate ? Number(multifamily.interestRate) : null)} />
          <Metric label="Amort. Years" value={multifamily?.amortizationYears?.toString() ?? '—'} />
          <Metric label="Debt Service" value={fmt$(multifamily?.annualDebtService ? Number(multifamily.annualDebtService) : null)} />
          <Metric label="DSCR" value={multifamily?.dscr ? `${Number(multifamily.dscr).toFixed(2)}x` : '—'} />
          <Metric label="Vacancy" value={multifamily?.vacancyRate ? `${(Number(multifamily.vacancyRate) * 100).toFixed(0)}%` : '—'} />
        </div>
      </section>

      {/* Rent roll summary */}
      {rentRoll && rrMetrics && (
        <section className="mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-3">
            Rent Roll Summary ({rrMetrics.total} units)
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border border-zinc-100 rounded-lg">
              <thead>
                <tr className="bg-zinc-50 text-left text-zinc-400">
                  <th className="px-3 py-2 font-medium">Unit</th>
                  <th className="px-3 py-2 font-medium">Bed</th>
                  <th className="px-3 py-2 font-medium">Sqft</th>
                  <th className="px-3 py-2 font-medium">Current Rent</th>
                  <th className="px-3 py-2 font-medium">Market Rent</th>
                  <th className="px-3 py-2 font-medium">Lease End</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rentRoll.units.map((unit, i) => (
                  <tr key={i} className="border-t border-zinc-100">
                    <td className="px-3 py-1.5 font-mono">{unit.unitNum}</td>
                    <td className="px-3 py-1.5">{unit.bedrooms === 0 ? 'Studio' : `${unit.bedrooms}BR`}</td>
                    <td className="px-3 py-1.5 text-zinc-500">{unit.sqft ?? '—'}</td>
                    <td className="px-3 py-1.5 font-medium">{fmt$(unit.currentRent)}</td>
                    <td className="px-3 py-1.5 text-zinc-500">{unit.marketRent ? fmt$(unit.marketRent) : '—'}</td>
                    <td className="px-3 py-1.5 text-zinc-500">{unit.leaseEnd ? new Date(unit.leaseEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : '—'}</td>
                    <td className="px-3 py-1.5">{unit.status}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-zinc-200 bg-zinc-50 font-semibold">
                  <td className="px-3 py-2" colSpan={3}>Total</td>
                  <td className="px-3 py-2">{fmt$(rrMetrics.gsi / 12)}/mo</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="mt-2 flex gap-6 text-xs text-zinc-500">
            <span>Occupancy: <strong>{((1 - rrMetrics.vacancyRate) * 100).toFixed(0)}%</strong></span>
            <span>GSI (annual): <strong>{fmt$(rrMetrics.gsi)}</strong></span>
            {rrMetrics.lossToLease > 0 && <span>Loss-to-Lease: <strong>{fmt$(rrMetrics.lossToLease)}/yr</strong></span>}
          </div>
        </section>
      )}

      {/* T12 summary */}
      {t12 && t12Metrics && (
        <section className="mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-3">
            T12 Financials {t12.year ? `(${t12.year})` : ''}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border border-zinc-100 rounded-lg">
              <thead>
                <tr className="bg-zinc-50 text-left text-zinc-400">
                  <th className="px-3 py-2 font-medium">Category</th>
                  {MONTHS.map(m => <th key={m} className="px-2 py-2 font-medium text-right">{m}</th>)}
                  <th className="px-3 py-2 font-medium text-right border-l border-zinc-100">Total</th>
                </tr>
              </thead>
              <tbody>
                {t12.rows.map((row, i) => (
                  <tr key={i} className="border-t border-zinc-100">
                    <td className="px-3 py-1.5 font-medium truncate max-w-32">
                      <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 mb-0.5 ${row.type === 'INCOME' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                      {row.category}
                    </td>
                    {row.values.map((v, j) => <td key={j} className="px-2 py-1.5 text-right text-zinc-600">{v ? fmt$(v) : '—'}</td>)}
                    <td className="px-3 py-1.5 text-right font-semibold border-l border-zinc-100">
                      {fmt$(row.values.reduce((a, b) => a + b, 0))}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-zinc-300 bg-zinc-50 font-bold">
                  <td className="px-3 py-2">NOI</td>
                  {t12Metrics.monthlyNoi.map((v, i) => (
                    <td key={i} className={`px-2 py-2 text-right ${v >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{fmt$(v)}</td>
                  ))}
                  <td className={`px-3 py-2 text-right border-l border-zinc-200 ${t12Metrics.annualNoi >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                    {fmt$(t12Metrics.annualNoi)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Value-add plan */}
      {businessPlan && (
        <section className="mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-3">Value-Add Plan</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border border-zinc-100 rounded-lg p-4 bg-zinc-50">
            <Metric label="Lift / Unit" value={`${fmt$(businessPlan.renovationLiftPerUnit)}/mo`} />
            <Metric label="Units Renovated" value={`${businessPlan.unitsRenovated} / ${businessPlan.targetUnitsToRenovate}`} />
            <Metric label="Progress" value={`${((businessPlan.unitsRenovated / businessPlan.targetUnitsToRenovate) * 100).toFixed(0)}%`} />
            <Metric label="Stabilized NOI" value={fmt$(businessPlan.stabilizedNoiTarget)} />
            {purchasePrice && <Metric label="Stabilized Cap Rate" value={fmtPct(businessPlan.stabilizedNoiTarget / purchasePrice)} />}
          </div>
          {businessPlan.notes && <p className="mt-2 text-xs text-zinc-500">{businessPlan.notes}</p>}
        </section>
      )}

      <div className="text-xs text-zinc-300 text-center mt-8 print:block hidden">
        Generated by Metis Platform · metisplatforms.com
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-zinc-400 mb-0.5">{label}</div>
      <div className="text-sm font-semibold text-zinc-800">{value}</div>
    </div>
  )
}
