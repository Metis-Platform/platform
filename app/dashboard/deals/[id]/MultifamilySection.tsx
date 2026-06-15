'use client'

import Link from 'next/link'

type ContactSummary = { id: string; firstName: string | null; lastName: string | null; company: string | null }

export type MultifamilyData = {
  dealId: string
  purchasePrice: string | null
  unitCount: number | null
  occupiedUnits: number | null
  averageMonthlyRent: string | null
  vacancyRate: string | null
  annualOpex: number | null
  grossScheduledIncome: string | null
  netOperatingIncome: string | null
  capRate: string | null
  loanAmount: string | null
  interestRate: string | null
  amortizationYears: number | null
  annualDebtService: string | null
  dscr: string | null
  loanMaturityDate: string | null
  propertyManagerContact: ContactSummary | null
  propertyManagerName: string | null
  propertyManagerPhone: string | null
  propertyManagerEmail: string | null
  notes: string | null
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="w-44 shrink-0 text-zinc-500">{label}</dt>
      <dd className="text-zinc-900">{value}</dd>
    </div>
  )
}

function fmt$(v: number | string | null | undefined) {
  if (v == null || v === '') return '—'
  const n = typeof v === 'string' ? Number(v) : v
  if (isNaN(n)) return '—'
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function fmtDate(v: string | null) {
  if (!v) return null
  return new Date(v).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function fmtPct(v: string | null, storedAsDecimal = true) {
  if (!v) return null
  const n = Number(v)
  if (isNaN(n)) return null
  const pct = storedAsDecimal ? n * 100 : n
  return `${pct.toFixed(1)}%`
}

function contactLabel(c: ContactSummary) {
  return [c.firstName, c.lastName].filter(Boolean).join(' ') || c.company || 'Contact'
}

export default function MultifamilySection({ data }: { data: MultifamilyData }) {
  const {
    dealId, unitCount, occupiedUnits, averageMonthlyRent, vacancyRate,
    grossScheduledIncome, netOperatingIncome, capRate,
    loanAmount, interestRate, amortizationYears, annualDebtService, dscr,
    loanMaturityDate, propertyManagerContact, propertyManagerName, propertyManagerPhone, propertyManagerEmail,
  } = data

  const noiNum  = netOperatingIncome ? Number(netOperatingIncome) : null
  const dscrNum = dscr ? Number(dscr) : null
  const capNum  = capRate ? Number(capRate) : null

  const occupancyRate = (unitCount && occupiedUnits != null)
    ? occupiedUnits / unitCount
    : null

  const now = new Date()
  const maturityDate = loanMaturityDate ? new Date(loanMaturityDate) : null
  const daysToMaturity = maturityDate
    ? Math.floor((maturityDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null

  const hasUnderwriting = grossScheduledIncome || netOperatingIncome || capRate
  const hasLoan = loanAmount || loanMaturityDate

  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-zinc-900">Multifamily Details</h2>
        <Link href={`/dashboard/deals/${dealId}/edit`} className="text-xs text-zinc-500 hover:text-zinc-900 transition-colors">
          Edit
        </Link>
      </div>

      <dl className="space-y-2.5 text-sm">
        {unitCount != null && (
          <Row label="Units" value={
            <span className="font-medium">
              {unitCount} units
              {occupiedUnits != null && (
                <span className="ml-2 text-xs text-zinc-500">
                  ({occupiedUnits} occupied
                  {occupancyRate != null && `, ${(occupancyRate * 100).toFixed(0)}% occupancy`})
                </span>
              )}
            </span>
          } />
        )}
        {averageMonthlyRent && <Row label="Avg Monthly Rent" value={fmt$(averageMonthlyRent)} />}
        {vacancyRate && <Row label="Vacancy Rate" value={fmtPct(vacancyRate)} />}
      </dl>

      {hasUnderwriting && (
        <div className="mt-4 rounded-lg border border-zinc-100 bg-zinc-50 p-4">
          <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">Underwriting</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {grossScheduledIncome && (
              <div>
                <div className="text-xs text-zinc-500 mb-0.5">GSI</div>
                <div className="text-base font-bold text-zinc-800">{fmt$(grossScheduledIncome)}</div>
              </div>
            )}
            {noiNum != null && (
              <div>
                <div className="text-xs text-zinc-500 mb-0.5">NOI</div>
                <div className={`text-base font-bold ${noiNum >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                  {fmt$(noiNum)}
                </div>
              </div>
            )}
            {capNum != null && (
              <div>
                <div className="text-xs text-zinc-500 mb-0.5">Cap Rate</div>
                <div className={`text-base font-bold ${capNum >= 0.07 ? 'text-emerald-700' : capNum >= 0.05 ? 'text-zinc-800' : 'text-amber-600'}`}>
                  {(capNum * 100).toFixed(1)}%
                </div>
              </div>
            )}
            {dscrNum != null && (
              <div>
                <div className="text-xs text-zinc-500 mb-0.5">DSCR</div>
                <div className={`text-base font-bold ${dscrNum >= 1.25 ? 'text-emerald-700' : dscrNum >= 1 ? 'text-amber-600' : 'text-red-600'}`}>
                  {dscrNum.toFixed(2)}x
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {hasLoan && (
        <div className="mt-4 rounded-lg border border-zinc-100 bg-zinc-50 p-4">
          <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">Loan</div>
          <dl className="space-y-2 text-sm">
            {loanAmount && <Row label="Loan Amount" value={fmt$(loanAmount)} />}
            {interestRate && <Row label="Interest Rate" value={fmtPct(interestRate)} />}
            {amortizationYears && <Row label="Amortization" value={`${amortizationYears} years`} />}
            {annualDebtService && <Row label="Annual Debt Service" value={fmt$(annualDebtService)} />}
            {loanMaturityDate && (
              <Row label="Loan Maturity" value={
                <span className={daysToMaturity != null && daysToMaturity < 365 && daysToMaturity > 0 ? 'text-amber-600 font-medium' : ''}>
                  {fmtDate(loanMaturityDate)}
                  {daysToMaturity != null && daysToMaturity > 0 && daysToMaturity < 365 && (
                    <span className="ml-2 text-xs">({Math.ceil(daysToMaturity / 30)} mo remaining)</span>
                  )}
                  {daysToMaturity != null && daysToMaturity <= 0 && (
                    <span className="ml-2 text-xs text-red-600">⚠ matured</span>
                  )}
                </span>
              } />
            )}
          </dl>
        </div>
      )}

      {(propertyManagerContact || propertyManagerName) && (
        <dl className="space-y-2.5 text-sm mt-4">
          {propertyManagerContact ? (
            <Row label="Prop. Manager" value={
              <Link href={`/dashboard/contacts/${propertyManagerContact.id}`} className="text-blue-600 hover:underline">
                {contactLabel(propertyManagerContact)}
              </Link>
            } />
          ) : (
            <>
              <Row label="Prop. Manager" value={propertyManagerName} />
              {propertyManagerPhone && <Row label="PM Phone" value={propertyManagerPhone} />}
              {propertyManagerEmail && <Row label="PM Email" value={propertyManagerEmail} />}
            </>
          )}
        </dl>
      )}
    </div>
  )
}
