import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/db'
import { syncUserToDatabase } from '@/lib/sync-user'
import { getStateInfo, investmentTypeBadgeClass } from '@/lib/state-info'

export const dynamic = 'force-dynamic'

const INVESTMENT_LABELS: Record<string, string> = {
  LIEN: 'Tax Lien',
  DEED: 'Tax Deed',
  REDEEMABLE_DEED: 'Redeemable Deed',
}

export default async function JurisdictionsPage() {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) redirect('/sign-in')

  const synced = await syncUserToDatabase()
  if (!synced) redirect('/onboarding')

  const jurisdictions = await db.jurisdiction.findMany({
    orderBy: [{ state: 'asc' }, { county: 'asc' }],
    select: {
      id: true,
      state: true,
      stateName: true,
      county: true,
      investmentType: true,
      isAvailable: true,
      ruleSets: {
        where: { isActive: true },
        select: { id: true, name: true, _count: { select: { rules: true } } },
        take: 1,
      },
    },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Jurisdiction Research</h1>
        <p className="mt-1 text-sm text-zinc-500">
          State and county tax sale rules, deadlines, statutes, and official research links.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {jurisdictions.map((jurisdiction) => {
          const stateInfo = getStateInfo(jurisdiction.state)
          const activeRuleSet = jurisdiction.ruleSets[0] ?? null

          return (
            <Link
              key={jurisdiction.id}
              href={`/dashboard/jurisdictions/${jurisdiction.id}`}
              className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-zinc-900">
                    {jurisdiction.county} County, {jurisdiction.state}
                  </h2>
                  <p className="text-sm text-zinc-500">{jurisdiction.stateName}</p>
                </div>
                <span
                  className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${investmentTypeBadgeClass(stateInfo?.investmentType ?? 'NOT_ACTIVE')}`}
                >
                  {stateInfo?.investmentLabel ?? INVESTMENT_LABELS[jurisdiction.investmentType] ?? jurisdiction.investmentType}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Interest / Penalty</p>
                  <p className="mt-0.5 text-zinc-700">{stateInfo?.interestRate ?? 'Varies'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Redemption</p>
                  <p className="mt-0.5 text-zinc-700">{stateInfo?.redemptionPeriod ?? 'N/A'}</p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3 text-xs">
                <span className={jurisdiction.isAvailable ? 'font-medium text-emerald-700' : 'text-zinc-400'}>
                  {jurisdiction.isAvailable ? 'Available for deals' : 'Research only'}
                </span>
                <span className={activeRuleSet ? 'font-medium text-blue-700' : 'text-amber-700'}>
                  {activeRuleSet ? `${activeRuleSet._count.rules} active rules` : 'Rules pending'}
                </span>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
