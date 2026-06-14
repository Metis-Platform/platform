import { STRATEGY_FIELDS } from '@/lib/jurisdiction-strategy-fields'
import type { StateInfo } from '@/lib/state-info'

type Props = {
  strategy: string
  jurisdictionName: string
  strategyData: Record<string, unknown> | null
  stateInfo: StateInfo | null
}

export default function JurisdictionGuide({ strategy, jurisdictionName, strategyData, stateInfo }: Props) {
  const fields = STRATEGY_FIELDS[strategy]

  const hasTaxLienInfo = strategy === 'TAX_LIEN' && stateInfo != null && (stateInfo.interestRate != null || stateInfo.redemptionPeriod != null)
  const hasStrategyData = fields && strategyData && Object.keys(strategyData).length > 0

  if (!hasTaxLienInfo && !hasStrategyData) {
    return (
      <details className="group bg-white rounded-xl border border-zinc-200 mb-6">
        <summary className="flex cursor-pointer list-none items-center justify-between p-6 select-none">
          <h2 className="text-sm font-semibold text-zinc-900">Jurisdiction Guide</h2>
          <span className="text-xs text-zinc-400 group-open:hidden">Expand</span>
          <span className="text-xs text-zinc-400 hidden group-open:inline">Collapse</span>
        </summary>
        <div className="border-t border-zinc-100 px-6 pb-6 pt-4">
          <p className="text-sm text-zinc-400">No rules on file for {jurisdictionName}.</p>
        </div>
      </details>
    )
  }

  return (
    <details className="group bg-white rounded-xl border border-zinc-200 mb-6">
      <summary className="flex cursor-pointer list-none items-center justify-between p-6 select-none">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Jurisdiction Guide</h2>
          <p className="text-xs text-zinc-500 mt-0.5">{jurisdictionName} — local rules &amp; requirements</p>
        </div>
        <span className="text-xs font-medium text-blue-600 group-open:hidden">Show ▾</span>
        <span className="text-xs font-medium text-blue-600 hidden group-open:inline">Hide ▴</span>
      </summary>

      <div className="border-t border-zinc-100 px-6 pb-6 pt-4">
        {strategy === 'TAX_LIEN' && stateInfo != null ? (
          <dl className="space-y-3 text-sm">
            {stateInfo.interestRate != null && (
              <div className="flex gap-3">
                <dt className="w-48 shrink-0 text-zinc-500">Interest / Penalty Rate</dt>
                <dd className="text-zinc-900">{stateInfo.interestRate}</dd>
              </div>
            )}
            {stateInfo.redemptionPeriod != null && (
              <div className="flex gap-3">
                <dt className="w-48 shrink-0 text-zinc-500">Redemption Period</dt>
                <dd className="text-zinc-900">{stateInfo.redemptionPeriod}</dd>
              </div>
            )}
            {stateInfo.investmentLabel != null && (
              <div className="flex gap-3">
                <dt className="w-48 shrink-0 text-zinc-500">Investment Type</dt>
                <dd className="text-zinc-900">{stateInfo.investmentLabel}</dd>
              </div>
            )}
          </dl>
        ) : fields && strategyData ? (
          <dl className="space-y-3 text-sm">
            {fields.map(field => {
              const val = strategyData[field.key]
              if (val === null || val === undefined || val === '') return null
              let display: string
              if (field.type === 'boolean') {
                display = val ? 'Yes' : 'No'
              } else {
                display = String(val)
              }
              return (
                <div key={field.key} className="flex gap-3">
                  <dt className="w-64 shrink-0 text-zinc-500">{field.label}</dt>
                  <dd className="text-zinc-900">{display}</dd>
                </div>
              )
            })}
          </dl>
        ) : null}
      </div>
    </details>
  )
}
