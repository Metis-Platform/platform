import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { InvestmentType } from '@/app/generated/prisma'
import { parseStrategyParam, getStrategyMeta } from '@/lib/strategy-meta'
import { NewLienForm } from './form'
import { prefilledResearchApn, prefilledResearchSnapshotId } from '@/lib/research-deal-handoff'

export const dynamic = 'force-dynamic'

export default async function NewLienPage({
  searchParams,
}: {
  searchParams: Promise<{ strategy?: string; jid?: string; apn?: string; research?: string }>
}) {
  const { strategy: strategyParam, jid, apn, research } = await searchParams
  const strategyKey = parseStrategyParam(strategyParam)
  const meta = getStrategyMeta(strategyKey)

  if (!meta.creatable) {
    redirect(`/dashboard/deals?strategy=${strategyKey}`)
  }

  // TAX_LIEN → LIEN counties only; TAX_DEED → DEED + REDEEMABLE_DEED; everything else → all counties.
  // isAvailable (ruleset-activated) is no longer the gate — strategy × investmentType is sufficient.
  const investmentTypeWhere =
    strategyKey === 'TAX_LIEN'
      ? { investmentType: InvestmentType.LIEN }
      : strategyKey === 'TAX_DEED'
      ? { investmentType: { in: [InvestmentType.DEED, InvestmentType.REDEEMABLE_DEED] } }
      : {}

  const [jurisdictions, preselected] = await Promise.all([
    db.jurisdiction.findMany({
      where: investmentTypeWhere,
      orderBy: [{ stateName: 'asc' }, { county: 'asc' }],
    }),
    jid
      ? db.jurisdiction.findUnique({
          where: { id: jid },
          select: { id: true, county: true, stateName: true, state: true },
        })
      : null,
  ])

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-900">{meta.newTitle}</h1>
        <p className="text-sm text-zinc-500 mt-0.5">{meta.newSubtitle}</p>
      </div>
      <NewLienForm jurisdictions={jurisdictions} strategy={strategyKey} preselected={preselected ? {
        ...preselected,
        apn: prefilledResearchApn(apn),
        researchSnapshotId: prefilledResearchSnapshotId(research),
      } : null} />
    </div>
  )
}
