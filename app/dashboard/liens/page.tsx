import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { syncUserToDatabase } from '@/lib/sync-user'
import { db } from '@/lib/db'
import { StrategyType, EventStatus } from '@/app/generated/prisma'

export default async function LiensPage() {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) redirect('/sign-in')

  const synced = await syncUserToDatabase()
  if (!synced) redirect('/onboarding')

  const { tenant } = synced

  const deals = await db.deal.findMany({
    where: { tenantId: tenant.id, strategyType: StrategyType.TAX_LIEN },
    include: {
      property: { include: { jurisdiction: true } },
      taxLien: true,
      // First upcoming PENDING event
      events: {
        where: { status: EventStatus.PENDING },
        orderBy: { dueDate: 'asc' },
        take: 1,
      },
      // Count of OVERDUE events
      _count: { select: { events: { where: { status: EventStatus.OVERDUE } } } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Tax Liens</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{deals.length} total</p>
        </div>
        <Link
          href="/dashboard/liens/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <span>+</span> New Lien
        </Link>
      </div>

      {deals.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-zinc-200">
          <p className="text-zinc-500 mb-4">No liens yet.</p>
          <Link
            href="/dashboard/liens/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
          >
            Add Your First Lien
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                <th className="px-4 py-3">Property / APN</th>
                <th className="px-4 py-3">Jurisdiction</th>
                <th className="px-4 py-3">Certificate #</th>
                <th className="px-4 py-3">Issue Date</th>
                <th className="px-4 py-3 text-right">Face Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Next Deadline</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {deals.map(deal => {
                const nextEvent  = deal.events[0]
                const overdueQty = deal._count.events
                const daysUntil  = nextEvent
                  ? Math.round((nextEvent.dueDate.getTime() - Date.now()) / 86_400_000)
                  : null

                return (
                  <tr key={deal.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/liens/${deal.id}`}
                        className="font-medium text-blue-600 hover:underline font-mono text-xs"
                      >
                        {deal.property.apn}
                      </Link>
                      {deal.property.address && (
                        <div className="text-xs text-zinc-400 truncate max-w-52 mt-0.5">
                          {deal.property.address}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      {deal.property.jurisdiction.county}, {deal.property.jurisdiction.state}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-600">
                      {deal.taxLien?.certificateNumber ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      {deal.taxLien?.issueDate
                        ? new Date(deal.taxLien.issueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-zinc-900">
                      {deal.taxLien?.faceAmount
                        ? `$${Number(deal.taxLien.faceAmount).toLocaleString()}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {overdueQty > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                          {overdueQty} overdue
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {nextEvent ? (
                        <div>
                          <div className="text-zinc-700 truncate max-w-44 text-xs">{nextEvent.label}</div>
                          {daysUntil !== null && (
                            <div className={`text-xs font-medium mt-0.5 ${daysUntil <= 30 ? 'text-yellow-600' : 'text-zinc-400'}`}>
                              {daysUntil}d
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
