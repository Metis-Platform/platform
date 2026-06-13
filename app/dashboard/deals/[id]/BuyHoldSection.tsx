'use client'

import Link from 'next/link'

const STRATEGY_LABELS: Record<string, string> = {
  LONG_TERM:  'Long-Term Rental',
  SHORT_TERM: 'Short-Term Rental (STR)',
  MID_TERM:   'Mid-Term Rental',
  SECTION_8:  'Section 8 / HCV',
}

const INSPECTION_LABELS: Record<string, string> = {
  PENDING:  'Pending',
  PASSED:   'Passed',
  FAILED:   'Failed',
  NA:       'Not required',
}

export type BuyHoldData = {
  dealId: string
  dealStatus: string
  purchasePrice: string | null
  purchaseDate: string | null
  rentalStrategy: string | null
  targetMonthlyRent: string | null
  actualMonthlyRent: string | null
  securityDeposit: string | null
  leaseStartDate: string | null
  leaseEndDate: string | null
  tenantName: string | null
  tenantPhone: string | null
  tenantEmail: string | null
  propertyManagerName: string | null
  propertyManagerPhone: string | null
  propertyManagerEmail: string | null
  inspectionStatus: string | null
  maintenanceReserve: string | null
  notes: string | null
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="w-40 shrink-0 text-zinc-500">{label}</dt>
      <dd className="text-zinc-900">{value}</dd>
    </div>
  )
}

function fmt$(v: string | null) {
  if (!v) return null
  return `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function fmtDate(v: string | null) {
  if (!v) return null
  return new Date(v).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function BuyHoldSection({ data }: { data: BuyHoldData }) {
  const {
    dealId, rentalStrategy, targetMonthlyRent, actualMonthlyRent, securityDeposit,
    leaseStartDate, leaseEndDate, tenantName, tenantPhone, tenantEmail,
    propertyManagerName, propertyManagerPhone, propertyManagerEmail,
    inspectionStatus, maintenanceReserve, purchasePrice,
  } = data

  const now = new Date()
  const leaseEnd = leaseEndDate ? new Date(leaseEndDate) : null
  const daysUntilExpiry = leaseEnd ? Math.floor((leaseEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null
  const isLeaseExpired  = daysUntilExpiry != null && daysUntilExpiry < 0
  const isLeaseExpiring = daysUntilExpiry != null && daysUntilExpiry >= 0 && daysUntilExpiry <= 60

  const targetNum    = targetMonthlyRent ? Number(targetMonthlyRent) : null
  const actualNum    = actualMonthlyRent ? Number(actualMonthlyRent) : null
  const reserveNum   = maintenanceReserve ? Number(maintenanceReserve) : null
  const purchaseNum  = purchasePrice ? Number(purchasePrice) : null

  const displayRent = actualNum ?? targetNum
  const rentVariance = (actualNum != null && targetNum != null) ? actualNum - targetNum : null

  const annualRent = displayRent ? displayRent * 12 : null
  const grossYield = annualRent && purchaseNum ? ((annualRent / purchaseNum) * 100) : null

  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-zinc-900">Buy &amp; Hold Details</h2>
        <Link href={`/dashboard/deals/${dealId}/edit`} className="text-xs text-zinc-500 hover:text-zinc-900 transition-colors">
          Edit
        </Link>
      </div>

      <dl className="space-y-2.5 text-sm">
        {rentalStrategy && (
          <Row label="Rental Strategy" value={
            <span className="font-medium">{STRATEGY_LABELS[rentalStrategy] ?? rentalStrategy}</span>
          } />
        )}

        {displayRent != null && (
          <Row label="Monthly Rent" value={
            <span className="font-semibold text-emerald-700">
              {fmt$(String(displayRent))}
              {rentVariance != null && (
                <span className={`ml-2 text-xs font-normal ${rentVariance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  ({rentVariance >= 0 ? '+' : ''}{fmt$(String(rentVariance))} vs target)
                </span>
              )}
            </span>
          } />
        )}

        {targetMonthlyRent && !actualMonthlyRent && (
          <Row label="Target Rent" value={fmt$(targetMonthlyRent)} />
        )}

        {securityDeposit && <Row label="Security Deposit" value={fmt$(securityDeposit)} />}

        {maintenanceReserve && (
          <Row label="Maint. Reserve" value={fmt$(maintenanceReserve)} />
        )}
      </dl>

      {/* Gross yield summary */}
      {(grossYield != null || annualRent != null) && (
        <div className="mt-4 rounded-lg border border-zinc-100 bg-zinc-50 p-4">
          <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">Rental Economics</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {annualRent != null && (
              <div>
                <div className="text-xs text-zinc-500 mb-0.5">Annual Rent</div>
                <div className="text-base font-bold text-emerald-700">{fmt$(String(annualRent))}</div>
              </div>
            )}
            {grossYield != null && (
              <div>
                <div className="text-xs text-zinc-500 mb-0.5">Gross Yield</div>
                <div className="text-base font-bold text-emerald-700">{grossYield.toFixed(1)}%</div>
              </div>
            )}
            {reserveNum != null && annualRent != null && (
              <div>
                <div className="text-xs text-zinc-500 mb-0.5">Reserve / Mo</div>
                <div className="text-base font-bold text-zinc-800">{fmt$(String(reserveNum))}</div>
              </div>
            )}
          </div>
        </div>
      )}

      <dl className="space-y-2.5 text-sm mt-4">
        {/* Lease info */}
        {leaseStartDate && <Row label="Lease Start" value={fmtDate(leaseStartDate)} />}

        {leaseEndDate && (
          <Row label="Lease End" value={
            <span className={
              isLeaseExpired ? 'text-red-600 font-medium' :
              isLeaseExpiring ? 'text-amber-600 font-medium' : ''
            }>
              {fmtDate(leaseEndDate)}
              {isLeaseExpired && ' ⚠ expired'}
              {!isLeaseExpired && isLeaseExpiring && ` (expires in ${daysUntilExpiry}d)`}
            </span>
          } />
        )}

        {/* Tenant info */}
        {tenantName && <Row label="Tenant" value={tenantName} />}
        {tenantPhone && <Row label="Tenant Phone" value={tenantPhone} />}
        {tenantEmail && <Row label="Tenant Email" value={tenantEmail} />}

        {/* Inspection */}
        {inspectionStatus && (
          <Row label="Inspection" value={
            <span className={
              inspectionStatus === 'PASSED' ? 'text-emerald-700' :
              inspectionStatus === 'FAILED' ? 'text-red-600' : 'text-zinc-700'
            }>
              {INSPECTION_LABELS[inspectionStatus] ?? inspectionStatus}
            </span>
          } />
        )}

        {/* Property manager */}
        {propertyManagerName && <Row label="Prop. Manager" value={propertyManagerName} />}
        {propertyManagerPhone && <Row label="PM Phone" value={propertyManagerPhone} />}
        {propertyManagerEmail && <Row label="PM Email" value={propertyManagerEmail} />}
      </dl>
    </div>
  )
}
