import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { parseStrategyParam, getStrategyMeta } from '@/lib/strategy-meta'
import { NewLienForm } from './form'

export const dynamic = 'force-dynamic'

export default async function NewLienPage({
  searchParams,
}: {
  searchParams: Promise<{ strategy?: string }>
}) {
  const { strategy: strategyParam } = await searchParams
  const strategyKey = parseStrategyParam(strategyParam)
  const meta = getStrategyMeta(strategyKey)

  if (!meta.creatable) {
    redirect(`/dashboard/deals?strategy=${strategyKey}`)
  }

  // Non-lien strategies can be in any county, not just lien-configured ones
  const allJurisdictions = strategyKey === 'LAND' || strategyKey === 'WHOLESALE' || strategyKey === 'FIX_FLIP' || strategyKey === 'BUY_HOLD'
  const jurisdictions = await db.jurisdiction.findMany({
    where: allJurisdictions ? {} : { isAvailable: true },
    orderBy: [{ stateName: 'asc' }, { county: 'asc' }],
  })

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-900">{meta.newTitle}</h1>
        <p className="text-sm text-zinc-500 mt-0.5">{meta.newSubtitle}</p>
      </div>
      <NewLienForm jurisdictions={jurisdictions} strategy={strategyKey} />
    </div>
  )
}
