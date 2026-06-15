import DataGapChip from './DataGapChip'
import { EXIT_META } from '@/lib/exit-engine/keys'
import type { ExitResult, Projection, Verdict } from '@/lib/exit-engine/types'

const VERDICT_CLASSES: Record<Verdict, string> = {
  VIABLE: 'bg-emerald-100 text-emerald-700',
  CONDITIONAL: 'bg-amber-100 text-amber-700',
  NOT_VIABLE: 'bg-red-100 text-red-700',
  INSUFFICIENT_DATA: 'bg-zinc-100 text-zinc-600',
}

const BAR_CLASSES: Record<Verdict, string> = {
  VIABLE: 'bg-emerald-500',
  CONDITIONAL: 'bg-amber-500',
  NOT_VIABLE: 'bg-red-500',
  INSUFFICIENT_DATA: 'bg-zinc-400',
}

export default function ExitResultCard({ result, dealId }: { result: ExitResult; dealId: string }) {
  const confidencePct = Math.round(result.confidence * 100)

  return (
    <article className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-zinc-900">{EXIT_META[result.exitKey].label}</h3>
          <p className="mt-1 text-xs text-zinc-500">{EXIT_META[result.exitKey].family}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${VERDICT_CLASSES[result.verdict]}`}>
          {result.verdict.replaceAll('_', ' ')}
        </span>
      </div>

      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="font-medium text-zinc-600">Confidence</span>
          <span className="text-zinc-500">{confidencePct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
          <div className={`h-full rounded-full ${BAR_CLASSES[result.verdict]}`} style={{ width: `${confidencePct}%` }} />
        </div>
      </div>

      {result.projection && <ProjectionSummary projection={result.projection} />}

      {result.blockers.length > 0 && (
        <ListBlock tone="red" title="Blockers" items={result.blockers} marker="×" />
      )}
      {result.conditions.length > 0 && (
        <ListBlock tone="amber" title="Conditions" items={result.conditions} marker="!" />
      )}
      {result.dataGaps.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Data gaps</p>
          <div className="flex flex-wrap gap-2">
            {result.dataGaps.map(gap => (
              <DataGapChip key={`${result.exitKey}-${gap.field}`} gap={gap} dealId={dealId} />
            ))}
          </div>
        </div>
      )}
    </article>
  )
}

function ProjectionSummary({ projection }: { projection: Projection }) {
  const label = projection.metric === 'monthly_cashflow' ? 'Monthly cashflow'
    : projection.metric === 'net_profit' ? 'Net profit'
      : projection.metric.toUpperCase()

  return (
    <div className="mt-4 rounded-lg border border-zinc-100 bg-zinc-50 p-3">
      <p className="text-xs font-semibold text-zinc-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-zinc-900">
        {formatProjectionValue(projection.low, projection.metric)}
        {'–'}
        {formatProjectionValue(projection.high, projection.metric)}
        <span className="ml-1 text-xs font-normal text-zinc-500">
          mid {formatProjectionValue(projection.mid, projection.metric)}
        </span>
      </p>
      <p className="mt-1 text-xs text-zinc-400">{projection.basis}</p>
    </div>
  )
}

function ListBlock({ tone, title, items, marker }: { tone: 'red' | 'amber'; title: string; items: string[]; marker: string }) {
  const classes = tone === 'red' ? 'text-red-700' : 'text-amber-700'
  return (
    <div className="mt-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">{title}</p>
      <ul className="space-y-1.5 text-xs">
        {items.map(item => (
          <li key={item} className={`flex gap-2 ${classes}`}>
            <span className="shrink-0 font-bold">{marker}</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function formatProjectionValue(value: number, metric: Projection['metric']) {
  if (metric === 'roi' || metric === 'irr') {
    return `${(value * 100).toFixed(1)}%`
  }

  const abs = Math.abs(value)
  const compact = abs >= 1000 ? `${value < 0 ? '-' : ''}$${Math.round(abs / 1000)}K` : formatCurrency(value)
  return compact
}

function formatCurrency(value: number) {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  })
}
