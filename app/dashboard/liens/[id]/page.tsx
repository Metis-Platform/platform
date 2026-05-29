import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { syncUserToDatabase } from '@/lib/sync-user'
import { db } from '@/lib/db'
import { EventStatus } from '@/app/generated/prisma'
import { DeleteButton } from './delete-button'

export default async function LienDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { userId, orgId } = await auth()
  if (!userId || !orgId) redirect('/sign-in')

  const synced = await syncUserToDatabase()
  if (!synced) redirect('/onboarding')
  const { tenant } = synced

  const deal = await db.deal.findUnique({
    where: { id, tenantId: tenant.id },
    include: {
      property: { include: { jurisdiction: true } },
      taxLien: true,
      events: { orderBy: { dueDate: 'asc' } },
    },
  })

  if (!deal) notFound()

  const { taxLien, property, events } = deal
  const overdueCount = events.filter(e => e.status === EventStatus.OVERDUE).length

  return (
    <div className="max-w-4xl">
      {/* Breadcrumb + actions */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Link href="/dashboard/liens" className="hover:text-zinc-900 transition-colors">Liens</Link>
          <span>/</span>
          <span className="text-zinc-900 font-medium font-mono">{property.apn}</span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/liens/${deal.id}/edit`}
            className="px-3 py-1.5 text-sm font-medium text-zinc-700 border border-zinc-300 rounded-lg hover:bg-zinc-50 transition-colors"
          >
            Edit
          </Link>
          <DeleteButton dealId={deal.id} />
        </div>
      </div>

      {/* Header */}
      <div className="bg-white rounded-xl border border-zinc-200 p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1">
              {property.jurisdiction.county} County, {property.jurisdiction.stateName}
            </p>
            <h1 className="text-2xl font-bold text-zinc-900 font-mono">{property.apn}</h1>
            {property.address && (
              <p className="text-sm text-zinc-500 mt-1">{property.address}</p>
            )}
          </div>
          {overdueCount > 0 ? (
            <span className="shrink-0 inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-red-100 text-red-700">
              {overdueCount} Overdue
            </span>
          ) : (
            <span className="shrink-0 inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-700">
              Active
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Certificate Details */}
        <div className="bg-white rounded-xl border border-zinc-200 p-6">
          <h2 className="text-sm font-semibold text-zinc-900 mb-4">Certificate Details</h2>
          <dl className="space-y-3 text-sm">
            <Row label="Certificate #" value={<span className="font-mono">{taxLien?.certificateNumber ?? '—'}</span>} />
            <Row
              label="Face Amount"
              value={taxLien?.faceAmount ? `$${Number(taxLien.faceAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
            />
            <Row
              label="Interest Rate"
              value={taxLien?.interestRate ? `${(Number(taxLien.interestRate) * 100).toFixed(2)}%` : '—'}
            />
            <Row
              label="Issue Date"
              value={taxLien?.issueDate
                ? new Date(taxLien.issueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                : '—'}
            />
            <Row label="Jurisdiction Type" value={property.jurisdiction.investmentType === 'LIEN' ? 'Lien State' : 'Deed State'} />
            {deal.notes && <Row label="Notes" value={deal.notes} />}
          </dl>
        </div>

        {/* Events Timeline */}
        <div className="bg-white rounded-xl border border-zinc-200 p-6">
          <h2 className="text-sm font-semibold text-zinc-900 mb-4">
            Deadlines
            <span className="ml-2 text-xs font-normal text-zinc-400">{events.length} events</span>
          </h2>
          {events.length === 0 ? (
            <p className="text-sm text-zinc-400">No events generated yet.</p>
          ) : (
            <ol className="space-y-3">
              {events.map(event => {
                const days = Math.round((event.dueDate.getTime() - Date.now()) / 86_400_000)
                const isOverdue   = event.status === EventStatus.OVERDUE
                const isCompleted = event.status === 'COMPLETED'
                const isSoon      = !isOverdue && !isCompleted && days <= 30

                const dot = isCompleted ? 'bg-green-500' : isOverdue ? 'bg-red-500' : isSoon ? 'bg-yellow-400' : 'bg-zinc-300'
                const dateColor = isCompleted ? 'text-green-700' : isOverdue ? 'text-red-600 font-semibold' : isSoon ? 'text-yellow-700' : 'text-zinc-500'
                const dayLabel = isCompleted
                  ? 'Completed'
                  : isOverdue
                  ? `${Math.abs(days)}d overdue`
                  : `${days}d remaining`

                return (
                  <li key={event.id} className="flex items-start gap-3">
                    <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${dot}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-800">{event.label}</p>
                      <p className={`text-xs mt-0.5 ${dateColor}`}>
                        {new Date(event.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        {' · '}
                        {dayLabel}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="w-36 shrink-0 text-zinc-500">{label}</dt>
      <dd className="text-zinc-900">{value}</dd>
    </div>
  )
}
