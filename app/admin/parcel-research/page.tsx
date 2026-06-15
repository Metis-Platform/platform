import Link from 'next/link'
import { redirect } from 'next/navigation'
import { isSuperAdmin } from '@/lib/admin-auth'
import { db } from '@/lib/db'

type Props = {
  searchParams: Promise<{ status?: string }>
}

const STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETE', 'CANCELLED'] as const

export default async function ParcelResearchQueuePage({ searchParams }: Props) {
  if (!(await isSuperAdmin())) redirect('/')

  const { status = 'PENDING' } = await searchParams
  const statusFilter = STATUSES.includes(status as typeof STATUSES[number]) ? status : 'PENDING'

  const [requests, pendingCount] = await Promise.all([
    db.parcelResearchRequest.findMany({
      where: { status: statusFilter },
      include: {
        tenant: { select: { name: true } },
        deal: {
          select: {
            id: true,
            strategyType: true,
            property: {
              select: {
                apn: true,
                state: true,
                jurisdiction: { select: { county: true, state: true } },
              },
            },
          },
        },
      },
      orderBy: [{ priority: 'desc' }, { requestedAt: 'asc' }],
      take: 100,
    }),
    db.parcelResearchRequest.count({ where: { status: 'PENDING' } }),
  ])

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Parcel Research</h1>
          <p className="mt-0.5 text-sm text-zinc-500">Manual parcel research requests from investor exit analysis.</p>
        </div>
        {pendingCount > 0 && (
          <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
            {pendingCount} pending
          </span>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {STATUSES.map(item => (
          <Link
            key={item}
            href={`/admin/parcel-research?status=${item}`}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
              item === statusFilter
                ? 'border-zinc-900 bg-zinc-900 text-white'
                : 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50'
            }`}
          >
            {labelize(item)}
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-3">APN</th>
              <th className="px-4 py-3">County</th>
              <th className="px-4 py-3">Tenant</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Requested</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Assigned</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {requests.map(request => (
              <tr key={request.id} className="hover:bg-zinc-50">
                <td className="px-4 py-3">
                  <Link href={`/admin/parcel-research/${request.id}`} className="font-mono text-blue-600 hover:underline">
                    {request.deal.property.apn}
                  </Link>
                </td>
                <td className="px-4 py-3 text-zinc-700">
                  {request.deal.property.jurisdiction.county}, {request.deal.property.jurisdiction.state}
                </td>
                <td className="px-4 py-3 text-zinc-700">{request.tenant.name}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">{labelize(request.status)}</span>
                </td>
                <td className="px-4 py-3 text-zinc-600">{formatDate(request.requestedAt)}</td>
                <td className="px-4 py-3 text-zinc-700">{labelize(request.priority)}</td>
                <td className="px-4 py-3 text-zinc-500">{request.adminUserId ?? 'Unassigned'}</td>
              </tr>
            ))}
            {requests.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                  No {labelize(statusFilter).toLowerCase()} requests.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function labelize(value: string) {
  return value.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, char => char.toUpperCase())
}

function formatDate(value: Date) {
  return value.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
