import Link from 'next/link'
import type { DataGap } from '@/lib/exit-engine/types'

export default function DataGapChip({ gap, dealId }: { gap: DataGap; dealId: string }) {
  const label = gap.label ?? gap.field
  const href = gap.deepLink ?? `/dashboard/deals/${dealId}/edit?focus=${encodeURIComponent(gap.field)}`

  return (
    <Link
      href={href}
      className="inline-flex max-w-full items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 transition-colors hover:border-blue-300 hover:bg-blue-100"
    >
      <span className="truncate">Add {label}</span>
      <span aria-hidden="true">→</span>
    </Link>
  )
}
