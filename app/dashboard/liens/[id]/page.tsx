import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { syncUserToDatabase } from '@/lib/sync-user'
import { db } from '@/lib/db'
import { EventStatus, DealStatus } from '@/app/generated/prisma'
import { DeleteButton } from './delete-button'

function buildResearchLinks(apn: string, address: string | null, stateName: string, county: string, state: string) {
  const mapQuery = encodeURIComponent(address || `${apn} ${county} County ${state}`)
  const netro = `https://www.netronline.com/${stateName.toLowerCase()}/county/${county.toLowerCase().replace(/\s+/g, '-').replace(/\./g, '')}`
  return [
    { label: 'Google Maps',  href: `https://www.google.com/maps/search/${mapQuery}`,          icon: '🗺️' },
    { label: 'Bing Maps',    href: `https://www.bing.com/maps?q=${mapQuery}`,                  icon: '🗺️' },
    { label: 'NETRonline',   href: netro,                                                       icon: '🔍' },
    { label: 'Zillow',       href: `https://www.zillow.com/homes/${mapQuery}_rb/`,              icon: '🏠' },
  ]
}

export default async function LienDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { userId, orgId } = await auth()
  if (!userId || !orgId) redirect('/sign-in')

  const synced = await syncUserToDatabase()
  if (!synced) redirect('/onboarding')
  const { tenant } = synced

  const deal = await db.deal.findUnique({
    where: { id, tenantId: tenant.id },
    include: { property: { include: { jurisdiction: true } }, taxLien: true, events: { orderBy: { dueDate: 'asc' } } },
  })
  if (!deal) notFound()

  const { taxLien, property, events } = deal
  const jur = property.jurisdiction
  const isLead = deal.status === DealStatus.LEAD
  const overdueCount = events.filter(e => e.status === EventStatus.OVERDUE).length
  const researchLinks = buildResearchLinks(property.apn, property.address, jur.stateName, jur.county, jur.state)

  return (
    <div className="max-w-4xl">
      {/* Breadcrumb + actions */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Link href="/dashboard/liens" className="hover:text-zinc-900">Liens</Link>
          <span>/</span>
          <span className="text-zinc-900 font-medium font-mono">{property.apn}</span>
        </div>
        <div className="flex items-center gap-2">
          {isLead && (
            <Link href={`/dashboard/liens/${deal.id}/convert`}
              className="px-3 py-1.5 text-sm font-medium text-green-700 border border-green-300 rounded-lg hover:bg-green-50 transition-colors">
              Won at Auction
            </Link>
          )}
          <Link href={`/dashboard/liens/${deal.id}/edit`}
            className="px-3 py-1.5 text-sm font-medium text-zinc-700 border border-zinc-300 rounded-lg hover:bg-zinc-50 transition-colors">
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
              {jur.county} County, {jur.stateName} &middot; {jur.investmentType === 'LIEN' ? 'Lien State' : jur.investmentType === 'REDEEMABLE_DEED' ? 'Redeemable Deed State' : 'Deed State'}
            </p>
            <h1 className="text-2xl font-bold text-zinc-900 font-mono">{property.apn}</h1>
            {property.address && <p className="text-sm text-zinc-500 mt-1">{property.address}</p>}
          </div>
          {isLead ? (
            <span className="shrink-0 px-3 py-1 rounded-full text-sm font-semibold bg-blue-100 text-blue-700">Lead</span>
          ) : overdueCount > 0 ? (
            <span className="shrink-0 px-3 py-1 rounded-full text-sm font-semibold bg-red-100 text-red-700">{overdueCount} Overdue</span>
          ) : (
            <span className="shrink-0 px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-700">Active</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Certificate / Lead details */}
        <div className="bg-white rounded-xl border border-zinc-200 p-6">
          <h2 className="text-sm font-semibold text-zinc-900 mb-4">
            {isLead ? 'Pre-Bid Info' : 'Certificate Details'}
          </h2>
          <dl className="space-y-3 text-sm">
            {isLead ? (
              <>
                <Row label="Status" value={<span className="text-blue-700 font-medium">Watchlist / Lead</span>} />
                <Row label="Auction Date" value={taxLien?.auctionDate ? new Date(taxLien.auctionDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'} />
                <Row label="Max Bid" value={taxLien?.maxBid ? `$${Number(taxLien.maxBid).toLocaleString()}` : '—'} />
              </>
            ) : (
              <>
                <Row label="Certificate #" value={<span className="font-mono">{taxLien?.certificateNumber ?? '—'}</span>} />
                <Row label="Face Amount" value={taxLien?.faceAmount ? `$${Number(taxLien.faceAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'} />
                <Row label="Interest Rate" value={taxLien?.interestRate ? `${(Number(taxLien.interestRate) * 100).toFixed(2)}%` : '—'} />
                <Row label="Issue Date" value={taxLien?.issueDate ? new Date(taxLien.issueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'} />
              </>
            )}
            {deal.notes && <Row label="Notes" value={deal.notes} />}
          </dl>
        </div>

        {/* Events / placeholder */}
        <div className="bg-white rounded-xl border border-zinc-200 p-6">
          <h2 className="text-sm font-semibold text-zinc-900 mb-4">
            Deadlines <span className="ml-2 text-xs font-normal text-zinc-400">{events.length} events</span>
          </h2>
          {isLead ? (
            <p className="text-sm text-zinc-400">Deadlines are generated automatically after you win at auction and convert this lead to active.</p>
          ) : events.length === 0 ? (
            <p className="text-sm text-zinc-400">No events generated yet.</p>
          ) : (
            <ol className="space-y-3">
              {events.map(event => {
                const days = Math.round((event.dueDate.getTime() - Date.now()) / 86_400_000)
                const isOver = event.status === EventStatus.OVERDUE
                const isDone = event.status === 'COMPLETED'
                const soon = !isOver && !isDone && days <= 30
                const dot = isDone ? 'bg-green-500' : isOver ? 'bg-red-500' : soon ? 'bg-yellow-400' : 'bg-zinc-300'
                const col = isDone ? 'text-green-700' : isOver ? 'text-red-600 font-semibold' : soon ? 'text-yellow-700' : 'text-zinc-500'
                const lbl = isDone ? 'Completed' : isOver ? `${Math.abs(days)}d overdue` : `${days}d remaining`
                return (
                  <li key={event.id} className="flex items-start gap-3">
                    <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${dot}`} />
                    <div>
                      <p className="text-sm text-zinc-800">{event.label}</p>
                      <p className={`text-xs mt-0.5 ${col}`}>
                        {new Date(event.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · {lbl}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </div>
      </div>

      {/* Research Links */}
      <div className="bg-white rounded-xl border border-zinc-200 p-6">
        <h2 className="text-sm font-semibold text-zinc-900 mb-4">Research Links</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {researchLinks.map(link => (
            <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer"
              className="flex flex-col items-center gap-2 p-3 rounded-lg border border-zinc-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-center">
              <span className="text-xl">{link.icon}</span>
              <span className="text-xs font-medium text-zinc-700">{link.label}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="w-32 shrink-0 text-zinc-500">{label}</dt>
      <dd className="text-zinc-900">{value}</dd>
    </div>
  )
}
