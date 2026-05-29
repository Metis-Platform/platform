import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { syncUserToDatabase } from '@/lib/sync-user'
import { db } from '@/lib/db'
import { StrategyType, EventStatus, DealStatus } from '@/app/generated/prisma'

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
      events: { where: { status: EventStatus.PENDING }, orderBy: { dueDate: 'asc' }, take: 1 },
      _count: { select: { events: { where: { status: EventStatus.OVERDUE } } } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const active = deals.filter(d => d.status !== DealStatus.LEAD)
  const leads  = deals.filter(d => d.status === DealStatus.LEAD)

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Tax Liens</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{active.length} active · {leads.length} leads</p>
        </div>
        <Link href="/dashboard/liens/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
          + New Lien
        </Link>
      </div>

      {deals.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-zinc-200">
          <p className="text-zinc-500 mb-4">No liens yet.</p>
          <Link href="/dashboard/liens/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
            Add Your First Lien
          </Link>
        </div>
      ) : (
        <LienTable deals={deals} />
      )}
    </div>
  )
}

type DealRow = Awaited<ReturnType<typeof import('@/lib/db').db.deal.findMany>>[number] & {
  property: { apn: string; address: string | null; jurisdiction: { county: string; state: string } }
  taxLien: { certificateNumber: string | null; issueDate: Date | null; faceAmount: unknown; auctionDate: Date | null } | null
  events: { label: string; dueDate: Date }[]
  _count: { events: number }
}

function LienTable({ deals }: { deals: DealRow[] }) {
  return (
    <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wide">
            <th className="px-4 py-3">Property / APN</th>
            <th className="px-4 py-3">Jurisdiction</th>
            <th className="px-4 py-3">Certificate #</th>
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3 text-right">Amount</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Next Deadline</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {deals.map(deal => {
            const isLead = deal.status === DealStatus.LEAD
            const next = deal.events[0]
            const overdue = deal._count.events
            const days = next ? Math.round((next.dueDate.getTime() - Date.now()) / 86_400_000) : null
            const date = isLead
              ? (deal.taxLien?.auctionDate ? new Date(deal.taxLien.auctionDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—')
              : (deal.taxLien?.issueDate ? new Date(deal.taxLien.issueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—')

            return (
              <tr key={deal.id} className="hover:bg-zinc-50 transition-colors">
                <td className="px-4 py-3">
                  <Link href={`/dashboard/liens/${deal.id}`} className="font-medium text-blue-600 hover:underline font-mono text-xs">
                    {deal.property.apn}
                  </Link>
                  {deal.property.address && <div className="text-xs text-zinc-400 truncate max-w-52 mt-0.5">{deal.property.address}</div>}
                </td>
                <td className="px-4 py-3 text-zinc-600">{deal.property.jurisdiction.county}, {deal.property.jurisdiction.state}</td>
                <td className="px-4 py-3 font-mono text-xs text-zinc-600">{deal.taxLien?.certificateNumber ?? '—'}</td>
                <td className="px-4 py-3 text-zinc-600 text-xs">{date}</td>
                <td className="px-4 py-3 text-right font-medium text-zinc-900">
                  {deal.taxLien?.faceAmount ? `$${Number(deal.taxLien.faceAmount).toLocaleString()}` : '—'}
                </td>
                <td className="px-4 py-3">
                  {isLead ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">Lead</span>
                  ) : overdue > 0 ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">{overdue} overdue</span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Active</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {next ? (
                    <div>
                      <div className="text-zinc-700 truncate max-w-44 text-xs">{next.label}</div>
                      {days !== null && <div className={`text-xs font-medium mt-0.5 ${days <= 30 ? 'text-yellow-600' : 'text-zinc-400'}`}>{days}d</div>}
                    </div>
                  ) : (
                    <span className="text-zinc-400 text-xs">{isLead ? 'Pending win' : '—'}</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
