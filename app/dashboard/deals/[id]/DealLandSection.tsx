import Link from 'next/link'

const ACCESS_LABEL: Record<string, string> = {
  ROAD:       'Road frontage',
  EASEMENT:   'Easement',
  LANDLOCKED: 'Landlocked',
  NONE:       'None confirmed',
  UNKNOWN:    'Unknown',
}

type UtilitiesJson = {
  water?: string | null
  sewer?: string | null
  electric?: string | null
  gas?: string | null
  notes?: string | null
} | null

export type DealLandData = {
  zoning: string | null
  access: string | null
  floodZone: string | null
  wetlandsPercent: { toString(): string } | null
  hoaName: string | null
  hoaFees: { toString(): string } | null
  optionExpiry: Date | null
  utilities: unknown
}

function UtilityItem({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-16 shrink-0 text-zinc-500">{label}</span>
      <span className={`text-zinc-900 ${!value || value === 'unknown' ? 'text-zinc-400 italic' : ''}`}>
        {value || 'unknown'}
      </span>
    </div>
  )
}

export default function DealLandSection({
  dealId,
  land,
  acres,
}: {
  dealId: string
  land: DealLandData
  acres: { toString(): string } | null
}) {
  const utilities = land.utilities as UtilitiesJson

  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-zinc-900">Parcel Details</h2>
        <Link
          href={`/dashboard/deals/${dealId}/edit`}
          className="text-xs text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          Edit
        </Link>
      </div>

      <dl className="space-y-3 text-sm">
        {acres && <Row label="Acres" value={Number(acres.toString()).toLocaleString()} />}
        {land.zoning && <Row label="Zoning" value={land.zoning} />}
        <Row label="Access" value={land.access ? (ACCESS_LABEL[land.access] ?? land.access) : '—'} />
        {land.floodZone && <Row label="Flood Zone" value={land.floodZone} />}
        {land.wetlandsPercent != null && (
          <Row label="Wetlands" value={`${Number(land.wetlandsPercent.toString()).toFixed(1)}%`} />
        )}
        {land.hoaName && <Row label="HOA / POA" value={land.hoaName} />}
        {land.hoaFees != null && (
          <Row label="HOA Fees" value={`$${Number(land.hoaFees.toString()).toLocaleString(undefined, { minimumFractionDigits: 2 })}/yr`} />
        )}
        {land.optionExpiry && (
          <Row
            label="Option Expiry"
            value={
              <span className={new Date(land.optionExpiry) < new Date() ? 'text-red-600 font-medium' : ''}>
                {new Date(land.optionExpiry).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
            }
          />
        )}
      </dl>

      {utilities && (
        <div className="mt-4 pt-4 border-t border-zinc-100">
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">Utilities</p>
          <div className="space-y-2">
            <UtilityItem label="Water" value={utilities.water} />
            <UtilityItem label="Sewer" value={utilities.sewer} />
            <UtilityItem label="Electric" value={utilities.electric} />
            <UtilityItem label="Gas" value={utilities.gas} />
            {utilities.notes && (
              <p className="text-xs text-zinc-500 pt-1">{utilities.notes}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="w-28 shrink-0 text-zinc-500">{label}</dt>
      <dd className="text-zinc-900">{value}</dd>
    </div>
  )
}
