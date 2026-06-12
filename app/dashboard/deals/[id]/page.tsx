import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { syncUserToDatabase } from '@/lib/sync-user'
import { db } from '@/lib/db'
import { DealStatus } from '@/app/generated/prisma'
import { DeleteButton } from './delete-button'
import { NotWonButton, RelistButton } from './not-won-button'
import DocumentSection, { type DocRow } from './DocumentSection'
import DealTaskSection, { type DealTask } from './DealTaskSection'
import TransactionSection, { type TxRow } from './TransactionSection'
import DealEventsSection, { type DealEvent } from './DealEventsSection'
import DealPnlCard, { type PnlCardTx, type PnlCardLien } from './DealPnlCard'
import { getStateInfo, investmentTypeBadgeClass } from '@/lib/state-info'
import { buildResearchLinkGroups } from '@/lib/research-links'

export default async function LienDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { userId, orgId } = await auth()
  if (!userId || !orgId) redirect('/sign-in')

  const synced = await syncUserToDatabase()
  if (!synced) redirect('/onboarding')
  const { tenant } = synced

  const [deal, rawDocs, rawTasks, rawTxs] = await Promise.all([
    db.deal.findUnique({
      where: { id, tenantId: tenant.id },
      include: {
        property: { include: { jurisdiction: true } },
        taxLien: true, taxDeed: true, foreclosure: true,
        events: { orderBy: { dueDate: 'asc' } },
      },
    }),
    db.document.findMany({
      where: { dealId: id, tenantId: tenant.id },
      orderBy: { uploadedAt: 'desc' },
    }),
    db.task.findMany({
      where: { dealId: id, tenantId: tenant.id, status: { not: 'CANCELLED' } },
      include: { assignedTo: { select: { id: true, name: true, email: true } } },
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
    }),
    db.financialTransaction.findMany({
      where: { dealId: id, tenantId: tenant.id },
      orderBy: { date: 'desc' },
    }),
  ])
  if (!deal) notFound()

  const docs: DocRow[] = rawDocs.map(d => ({
    id:         d.id,
    fileName:   d.fileName,
    fileSize:   d.fileSize,
    mimeType:   d.mimeType,
    docType:    d.docType,
    uploadedAt: d.uploadedAt.toISOString(),
  }))

  const dealTasks: DealTask[] = rawTasks.map(t => ({
    id:         t.id,
    title:      t.title,
    status:     t.status,
    priority:   t.priority,
    dueDate:    t.dueDate?.toISOString() ?? null,
    assignedTo: t.assignedTo,
  }))

  const dealTxs: TxRow[] = rawTxs.map(t => ({
    id:          t.id,
    type:        t.type,
    amount:      t.amount.toString(),
    date:        t.date.toISOString(),
    description: t.description,
  }))

  const dealEvents: DealEvent[] = deal.events.map((e) => ({
    id:            e.id,
    label:         e.label,
    eventType:     e.eventType as string,
    dueDate:       e.dueDate.toISOString(),
    completedDate: e.completedDate?.toISOString() ?? null,
    status:        e.status as string,
    notes:         e.notes,
  }))

  const { taxLien, taxDeed, foreclosure, property, events } = deal

  // PnL card data — reuse already-fetched rawTxs (no extra query)
  const pnlTxs: PnlCardTx[] = rawTxs.map(t => ({
    type:   t.type,
    amount: Number(t.amount),
    date:   t.date,
  }))
  const pnlLien: PnlCardLien | null =
    deal.strategyType === 'TAX_LIEN' &&
    taxLien?.faceAmount != null &&
    taxLien?.interestRate != null &&
    taxLien?.issueDate != null
      ? {
          faceAmount: Number(taxLien.faceAmount),
          annualRate: Number(taxLien.interestRate), // stored as fraction (0.18 = 18%)
          issueDate:  taxLien.issueDate,
          isRedeemed: taxLien.isRedeemed ?? false,
        }
      : null

  const isTaxDeed = deal.strategyType === 'TAX_DEED'
  const isForeclosure = deal.strategyType === 'FORECLOSURE'
  const jur = property.jurisdiction
  const isLead = deal.status === DealStatus.LEAD
  const isNotWon = (deal.status as string) === 'NOT_WON'
  const overdueCount = events.filter(e => e.status === 'OVERDUE').length
  const leadAuctionDate = isLead
    ? (isTaxDeed ? taxDeed?.auctionDate : isForeclosure ? foreclosure?.auctionDate : taxLien?.auctionDate)?.toISOString() ?? null
    : null
  const researchLinkGroups = buildResearchLinkGroups({
    apn: property.apn,
    address: property.address,
    state: jur.state,
    county: jur.county,
    strategyType: deal.strategyType,
    jurisdictionLinks: jur.links,
  })

  const stateInfo = getStateInfo(jur.state)

  // Check if this jurisdiction has an active ruleset (for the warning banner)
  const hasActiveRuleSet = await db.ruleSet.count({
    where: { jurisdictionId: jur.id, isActive: true },
  }) > 0

  return (
    <div className="max-w-4xl">
      {/* No-rules warning banner */}
      {!isLead && !hasActiveRuleSet && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3">
          <span className="mt-0.5 text-amber-500">⚠</span>
          <div className="text-sm">
            <span className="font-semibold text-amber-900">No deadline rules configured for {jur.county} County.</span>
            {' '}
            <span className="text-amber-800">Events won&apos;t be generated for this deal until a ruleset is activated.</span>
            {' '}
            <Link href="/admin/rules" className="font-medium text-amber-900 underline hover:text-amber-700">
              Configure rules →
            </Link>
          </div>
        </div>
      )}

      {/* Breadcrumb + actions */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Link href="/dashboard/deals" className="hover:text-zinc-900">Liens</Link>
          <span>/</span>
          <span className="text-zinc-900 font-medium font-mono">{property.apn}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isLead && (
            <>
              <Link href={`/dashboard/deals/${deal.id}/convert`}
                className="px-3 py-1.5 text-sm font-medium text-green-700 border border-green-300 rounded-lg hover:bg-green-50 transition-colors">
                Won at Auction
              </Link>
              <NotWonButton dealId={deal.id} auctionDate={leadAuctionDate} />
            </>
          )}
          {isNotWon && <RelistButton dealId={deal.id} />}
          {!isNotWon && (
            <Link href={`/dashboard/deals/${deal.id}/edit`}
              className="px-3 py-1.5 text-sm font-medium text-zinc-700 border border-zinc-300 rounded-lg hover:bg-zinc-50 transition-colors">
              Edit
            </Link>
          )}
          <DeleteButton dealId={deal.id} />
        </div>
      </div>

      {/* Header */}
      <div className="bg-white rounded-xl border border-zinc-200 p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                {jur.county} County, {jur.stateName}
              </p>
              {stateInfo && (
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${investmentTypeBadgeClass(stateInfo.investmentType)}`}>
                  {stateInfo.investmentLabel}
                </span>
              )}
              {stateInfo?.interestRate && (
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                  {stateInfo.interestRate}
                </span>
              )}
              {stateInfo?.redemptionPeriod && (
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                  {stateInfo.redemptionPeriod} redemption
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-zinc-900 font-mono">{property.apn}</h1>
            {property.address && <p className="text-sm text-zinc-500 mt-1">{property.address}</p>}
          </div>
          {isLead ? (
            <span className="shrink-0 px-3 py-1 rounded-full text-sm font-semibold bg-blue-100 text-blue-700">Lead</span>
          ) : isNotWon ? (
            <span className="shrink-0 px-3 py-1 rounded-full text-sm font-semibold bg-zinc-100 text-zinc-500">Not Won</span>
          ) : overdueCount > 0 ? (
            <span className="shrink-0 px-3 py-1 rounded-full text-sm font-semibold bg-red-100 text-red-700">{overdueCount} Overdue</span>
          ) : (
            <span className="shrink-0 px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-700">Active</span>
          )}
        </div>
      </div>

      {/* P&L card — hidden when no transactions and no lien accrual */}
      <DealPnlCard
        transactions={pnlTxs}
        dealStatus={deal.status}
        strategyType={deal.strategyType}
        lien={pnlLien}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 mt-6">
        {/* Certificate / Lead details */}
        <div className="bg-white rounded-xl border border-zinc-200 p-6">
          <h2 className="text-sm font-semibold text-zinc-900 mb-4">
            {isLead ? 'Pre-Bid Info' : isTaxDeed ? 'Deed Details' : isForeclosure ? 'Auction Details' : 'Certificate Details'}
          </h2>
          <dl className="space-y-3 text-sm">
            {isLead ? (
              <>
                <Row label="Status" value={<span className="text-blue-700 font-medium">Watchlist / Lead</span>} />
                <Row label="Auction Date" value={
                  (isForeclosure ? foreclosure?.auctionDate : isTaxDeed ? taxDeed?.auctionDate : taxLien?.auctionDate)
                    ? new Date((isForeclosure ? foreclosure!.auctionDate! : isTaxDeed ? taxDeed!.auctionDate! : taxLien!.auctionDate!)).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                    : '—'
                } />
                <Row label="Max Bid" value={
                  (isForeclosure ? foreclosure?.maxBid : isTaxDeed ? taxDeed?.maxBid : taxLien?.maxBid)
                    ? `$${Number(isForeclosure ? foreclosure!.maxBid : isTaxDeed ? taxDeed!.maxBid : taxLien!.maxBid).toLocaleString()}`
                    : '—'
                } />
                {isForeclosure && foreclosure?.estimatedLiens && (
                  <Row label="Est. Junior Liens" value={`$${Number(foreclosure.estimatedLiens).toLocaleString('en-US', { minimumFractionDigits: 2 })}`} />
                )}
              </>
            ) : isForeclosure ? (
              <>
                <Row label="Type" value={foreclosure?.foreclosureType ?? '—'} />
                <Row label="Auction Date" value={foreclosure?.auctionDate ? new Date(foreclosure.auctionDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'} />
                <Row label="Opening Bid" value={foreclosure?.openingBid ? `$${Number(foreclosure.openingBid).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'} />
                <Row label="Winning Bid" value={foreclosure?.winningBid ? `$${Number(foreclosure.winningBid).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'} />
                <Row label="Redemption Deadline" value={foreclosure?.redemptionDeadline ? new Date(foreclosure.redemptionDeadline).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'} />
              </>
            ) : isTaxDeed ? (
              <>
                <Row label="Sale Date" value={taxDeed?.saleDate ? new Date(taxDeed.saleDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'} />
                <Row label="Winning Bid" value={taxDeed?.winningBid ? `$${Number(taxDeed.winningBid).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'} />
                <Row label="Opening Bid" value={taxDeed?.openingBid ? `$${Number(taxDeed.openingBid).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'} />
                <Row label="Redemption Period" value={taxDeed?.redemptionPeriodDays ? `${taxDeed.redemptionPeriodDays} days` : '—'} />
                <Row label="Redemption Deadline" value={taxDeed?.redemptionDeadline ? new Date(taxDeed.redemptionDeadline).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'} />
                <Row label="Redeemed" value={taxDeed?.isRedeemed ? 'Yes' : 'No'} />
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

        {/* Events — clickable, slide-over editor */}
        {isLead ? (
          <div className="bg-white rounded-xl border border-zinc-200 p-6">
            <h2 className="text-sm font-semibold text-zinc-900 mb-4">Deadlines</h2>
            <p className="text-sm text-zinc-400">
              Deadlines are generated automatically after you win at auction and convert this lead to active.
            </p>
          </div>
        ) : (
          <DealEventsSection
            dealId={deal.id}
            apn={property.apn}
            address={property.address}
            events={dealEvents}
          />
        )}
      </div>

      {/* Research Links */}
      <div className="bg-white rounded-xl border border-zinc-200 p-6 mb-6">
        <div className="mb-5">
          <h2 className="text-sm font-semibold text-zinc-900">Research Links</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Tiered resources for parcel due diligence, strategy-specific research, and county records.
          </p>
        </div>
        <div className="space-y-6">
          {researchLinkGroups.map((group) => (
            <section key={group.title}>
              <div className="mb-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{group.title}</h3>
                <p className="mt-1 text-xs text-zinc-400">{group.description}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {group.links.map(link => (
                  <a key={`${group.title}-${link.label}`} href={link.href} target="_blank" rel="noopener noreferrer"
                    className="flex min-h-24 flex-col items-center gap-2 rounded-lg border border-zinc-200 p-3 text-center transition-colors hover:border-blue-300 hover:bg-blue-50">
                    <span className="text-xl">{link.icon}</span>
                    <span className="text-xs font-medium text-zinc-700">{link.label}</span>
                    {link.description && <span className="text-[11px] leading-4 text-zinc-400">{link.description}</span>}
                  </a>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      {/* Documents */}
      <DocumentSection dealId={deal.id} initialDocs={docs} />

      {/* Transactions */}
      <div className="mt-6">
        <TransactionSection dealId={deal.id} initialTransactions={dealTxs} />
      </div>

      {/* Tasks */}
      <div className="mt-6">
        <DealTaskSection dealId={deal.id} initialTasks={dealTasks} />
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
