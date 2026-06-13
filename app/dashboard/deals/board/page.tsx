import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { syncUserToDatabase } from '@/lib/sync-user'
import { db } from '@/lib/db'
import WholesaleBoard, { type BoardDeal } from '../WholesaleBoard'

export const dynamic = 'force-dynamic'

export default async function WholesaleBoardPage() {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) redirect('/sign-in')
  const synced = await syncUserToDatabase()
  if (!synced) redirect('/onboarding')
  const { tenant } = synced

  const deals = await db.deal.findMany({
    where: { tenantId: tenant.id, strategyType: 'WHOLESALE' },
    include: {
      property: { include: { jurisdiction: true } },
      wholesale: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  const boardDeals: BoardDeal[] = deals.map(d => ({
    id:                d.id,
    status:            d.status,
    apn:               d.property.apn,
    address:           d.property.address,
    county:            d.property.jurisdiction.county,
    state:             d.property.jurisdiction.state,
    dispositionStatus: d.wholesale?.dispositionStatus ?? null,
    contractPrice:     d.wholesale?.contractPrice != null ? Number(d.wholesale.contractPrice) : null,
    assignmentFee:     d.wholesale?.assignmentFee  != null ? Number(d.wholesale.assignmentFee)  : null,
    closingDeadline:   d.wholesale?.closingDeadline?.toISOString() ?? null,
    buyerName:         d.wholesale?.buyerName ?? null,
    leadSource:        d.wholesale?.leadSource ?? null,
  }))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-zinc-500 mb-2">
            <Link href="/dashboard/deals?strategy=WHOLESALE" className="hover:text-zinc-900">Wholesale Deals</Link>
            <span>/</span>
            <span className="text-zinc-900">Board</span>
          </div>
          <h1 className="text-2xl font-semibold text-zinc-900">Wholesale Pipeline Board</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{boardDeals.length} deals</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/deals?strategy=WHOLESALE"
            className="px-3 py-2 text-sm font-medium text-zinc-700 border border-zinc-300 rounded-lg hover:bg-zinc-50 transition-colors">
            ≡ List
          </Link>
          <Link href="/dashboard/deals/new?strategy=WHOLESALE"
            className="px-3 py-2 text-sm font-medium bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 transition-colors">
            + New Deal
          </Link>
        </div>
      </div>

      <WholesaleBoard deals={boardDeals} />
    </div>
  )
}
