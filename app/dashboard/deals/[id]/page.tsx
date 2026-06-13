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
import { hasTemplate } from '@/lib/checklists/registry'
import { hasTier } from '@/lib/entitlements'
import DealLandSection, { type DealLandData, type LandEconomics } from './DealLandSection'
import LandNoteSection, { type NoteData, type NotePayment } from './LandNoteSection'
import LandDispositionSection from './LandDispositionSection'
import WholesaleSection, { type WholesaleData, type MatchedBuyer, type LinkedBuyerContact } from './WholesaleSection'
import MaoCalculator from './MaoCalculator'
import FixFlipSection, { type FixFlipData } from './FixFlipSection'
import RehabBudgetSection from './RehabBudgetSection'
import BuyHoldSection, { type BuyHoldData } from './BuyHoldSection'
import RentalExpensesSection from './RentalExpensesSection'
import MultifamilySection, { type MultifamilyData } from './MultifamilySection'
import Section8Section, { type Section8Data } from './Section8Section'
import RentRollSection from './RentRollSection'
import T12Section from './T12Section'
import BusinessPlanSection from './BusinessPlanSection'
import { RentRollSchema, T12FinancialsSchema, BusinessPlanSchema } from '@/lib/multifamily-schemas'
import type { ScopeOfWork } from '@/lib/actions/rehab-budget'
import type { RentalExpenses } from '@/lib/actions/rental-expenses'

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
        taxLien: true, taxDeed: true, foreclosure: true, land: true, fixFlip: true, buyHold: true, multifamily: true,
        wholesale: { include: { buyerContact: { include: { buyerProfile: true } } } },
        events: { orderBy: { dueDate: 'asc' } },
        landNotes: { orderBy: { createdAt: 'desc' } },
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
    id:           t.id,
    title:        t.title,
    status:       t.status,
    priority:     t.priority,
    dueDate:      t.dueDate?.toISOString() ?? null,
    assignedTo:   t.assignedTo,
    checklistKey: t.checklistKey ?? null,
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

  const { taxLien, taxDeed, foreclosure, land, wholesale, fixFlip, buyHold, multifamily, property, events, landNotes } = deal

  const landData: DealLandData | null = land
    ? {
        zoning:          land.zoning,
        access:          land.access,
        floodZone:       land.floodZone,
        wetlandsPercent: land.wetlandsPercent,
        hoaName:         land.hoaName,
        hoaFees:         land.hoaFees,
        optionExpiry:    land.optionExpiry,
        utilities:       land.utilities,
      }
    : null

  // Land notes
  const noteRows: NoteData[] = landNotes.map(n => ({
    id:               n.id,
    buyerName:        n.buyerName,
    buyerEmail:       n.buyerEmail,
    buyerPhone:       n.buyerPhone,
    principal:        n.principal.toString(),
    interestRate:     n.interestRate.toString(),
    termMonths:       n.termMonths,
    paymentAmount:    n.paymentAmount.toString(),
    firstPaymentDate: n.firstPaymentDate.toISOString(),
    balance:          n.balance.toString(),
    status:           n.status,
    notes:            n.notes,
    createdAt:        n.createdAt.toISOString(),
  }))

  const notePayments: NotePayment[] = rawTxs
    .filter(t => t.type === 'NOTE_PAYMENT_RECEIVED')
    .map(t => ({
      id:          t.id,
      amount:      t.amount.toString(),
      date:        t.date.toISOString(),
      description: t.description,
    }))

  const activeNote = landNotes.find(n => n.status === 'ACTIVE') ?? null
  const totalNoteCollected = notePayments.reduce((sum, p) => sum + Number(p.amount), 0)

  const landEconomics: LandEconomics = {
    purchasePrice:      deal.purchasePrice != null ? Number(deal.purchasePrice) : null,
    assessedValue:      property.assessedValue != null ? Number(property.assessedValue) : null,
    acres:              property.acres != null ? Number(property.acres) : null,
    noteYield:          activeNote ? Number(activeNote.interestRate) * 100 : null,
    notePrincipal:      activeNote ? Number(activeNote.principal) : null,
    totalNoteCollected,
  }

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

  const isTaxDeed      = deal.strategyType === 'TAX_DEED'
  const isForeclosure  = deal.strategyType === 'FORECLOSURE'
  const isLand         = deal.strategyType === 'LAND'
  const isWholesale    = deal.strategyType === 'WHOLESALE'
  const isFixFlip      = deal.strategyType === 'FIX_FLIP'
  const isBuyHold      = deal.strategyType === 'BUY_HOLD'
  const isMultifamily  = deal.strategyType === 'MULTIFAMILY'

  const hasLandPremium = isLand ? await hasTier(tenant.id, 'LAND', 'PREMIUM') : false

  const fixFlipData: FixFlipData | null = isFixFlip
    ? {
        dealId:                deal.id,
        dealStatus:            deal.status,
        purchasePrice:         deal.purchasePrice?.toString() ?? null,
        purchaseDate:          deal.purchaseDate?.toISOString() ?? null,
        arv:                   fixFlip?.arv?.toString() ?? null,
        rehabBudget:           fixFlip?.rehabBudget?.toString() ?? null,
        rehabActualCost:       fixFlip?.rehabActualCost?.toString() ?? null,
        holdingCostEstimate:   fixFlip?.holdingCostEstimate?.toString() ?? null,
        rehabStartDate:        fixFlip?.rehabStartDate?.toISOString() ?? null,
        rehabTargetCompletion: fixFlip?.rehabTargetCompletion?.toISOString() ?? null,
        rehabCompletedDate:    fixFlip?.rehabCompletedDate?.toISOString() ?? null,
        listingDate:           fixFlip?.listingDate?.toISOString() ?? null,
        listingPrice:          fixFlip?.listingPrice?.toString() ?? null,
        acceptedOfferDate:     fixFlip?.acceptedOfferDate?.toISOString() ?? null,
        acceptedOfferPrice:    fixFlip?.acceptedOfferPrice?.toString() ?? null,
        closingDate:           fixFlip?.closingDate?.toISOString() ?? null,
        contractorName:        fixFlip?.contractorName ?? null,
        contractorPhone:       fixFlip?.contractorPhone ?? null,
        contractorEmail:       fixFlip?.contractorEmail ?? null,
        permitStatus:          fixFlip?.permitStatus ?? null,
        notes:                 deal.notes ?? null,
      }
    : null

  const buyHoldData: BuyHoldData | null = isBuyHold
    ? {
        dealId:               deal.id,
        dealStatus:           deal.status,
        purchasePrice:        deal.purchasePrice?.toString() ?? null,
        purchaseDate:         deal.purchaseDate?.toISOString() ?? null,
        rentalStrategy:       buyHold?.rentalStrategy ?? null,
        targetMonthlyRent:    buyHold?.targetMonthlyRent?.toString() ?? null,
        actualMonthlyRent:    buyHold?.actualMonthlyRent?.toString() ?? null,
        securityDeposit:      buyHold?.securityDeposit?.toString() ?? null,
        leaseStartDate:       buyHold?.leaseStartDate?.toISOString() ?? null,
        leaseEndDate:         buyHold?.leaseEndDate?.toISOString() ?? null,
        tenantName:           buyHold?.tenantName ?? null,
        tenantPhone:          buyHold?.tenantPhone ?? null,
        tenantEmail:          buyHold?.tenantEmail ?? null,
        propertyManagerName:  buyHold?.propertyManagerName ?? null,
        propertyManagerPhone: buyHold?.propertyManagerPhone ?? null,
        propertyManagerEmail: buyHold?.propertyManagerEmail ?? null,
        inspectionStatus:     buyHold?.inspectionStatus ?? null,
        maintenanceReserve:   buyHold?.maintenanceReserve?.toString() ?? null,
        operatingExpenses:    (buyHold?.operatingExpenses ?? null) as RentalExpenses | null,
        notes:                deal.notes ?? null,
      }
    : null

  const mfOpex = multifamily?.operatingExpenses as { total?: number } | null

  const mfRentRoll = multifamily?.rentRoll
    ? (() => { const r = RentRollSchema.safeParse(multifamily.rentRoll); return r.success ? r.data : null })()
    : null

  const mfT12 = multifamily?.t12Financials
    ? (() => { const r = T12FinancialsSchema.safeParse(multifamily.t12Financials); return r.success ? r.data : null })()
    : null

  const mfBusinessPlan = multifamily?.businessPlan
    ? (() => { const r = BusinessPlanSchema.safeParse(multifamily.businessPlan); return r.success ? r.data : null })()
    : null

  const multifamilyData: MultifamilyData | null = isMultifamily
    ? {
        dealId:               deal.id,
        purchasePrice:        deal.purchasePrice?.toString() ?? null,
        unitCount:            multifamily?.unitCount ?? null,
        occupiedUnits:        multifamily?.occupiedUnits ?? null,
        averageMonthlyRent:   multifamily?.averageMonthlyRent?.toString() ?? null,
        vacancyRate:          multifamily?.vacancyRate?.toString() ?? null,
        annualOpex:           mfOpex?.total ?? null,
        grossScheduledIncome: multifamily?.grossScheduledIncome?.toString() ?? null,
        netOperatingIncome:   multifamily?.netOperatingIncome?.toString() ?? null,
        capRate:              multifamily?.capRate?.toString() ?? null,
        loanAmount:           multifamily?.loanAmount?.toString() ?? null,
        interestRate:         multifamily?.interestRate?.toString() ?? null,
        amortizationYears:    multifamily?.amortizationYears ?? null,
        annualDebtService:    multifamily?.annualDebtService?.toString() ?? null,
        dscr:                 multifamily?.dscr?.toString() ?? null,
        loanMaturityDate:     multifamily?.loanMaturityDate?.toISOString() ?? null,
        propertyManagerName:  multifamily?.propertyManagerName ?? null,
        propertyManagerPhone: multifamily?.propertyManagerPhone ?? null,
        propertyManagerEmail: multifamily?.propertyManagerEmail ?? null,
        notes:                deal.notes ?? null,
      }
    : null

  const jur = property.jurisdiction

  // Section 8 premium — FMR lookup + tier check
  const isSection8 = isBuyHold && buyHold?.rentalStrategy === 'SECTION_8'
  const hasBuyHoldPremium = isSection8 ? await hasTier(tenant.id, 'BUY_HOLD', 'PREMIUM') : false

  let section8Data: Section8Data | null = null
  if (isSection8 && buyHold) {
    let fmrAmount: string | null = null
    if (buyHold.fmrBedrooms != null) {
      const fmrRow = await db.fmrRate.findUnique({
        where: { state_county_year_bedrooms: {
          state: jur.state,
          county: jur.county,
          year: new Date().getFullYear(),
          bedrooms: buyHold.fmrBedrooms,
        }},
        select: { amount: true },
      })
      fmrAmount = fmrRow?.amount?.toString() ?? null
    }
    section8Data = {
      dealId:                 deal.id,
      hapContractNumber:      buyHold.hapContractNumber ?? null,
      hapMonthlyAmount:       buyHold.hapMonthlyAmount?.toString() ?? null,
      tenantPortion:          buyHold.tenantPortion?.toString() ?? null,
      hapAnniversary:         buyHold.hapAnniversary?.toISOString() ?? null,
      nextHqsDate:            buyHold.nextHqsDate?.toISOString() ?? null,
      hqsResult:              buyHold.hqsResult ?? null,
      fmrBedrooms:            buyHold.fmrBedrooms ?? null,
      rentIncreaseNoticeDays: buyHold.rentIncreaseNoticeDays ?? null,
      actualMonthlyRent:      buyHold.actualMonthlyRent?.toString() ?? null,
      fmrAmount,
      housingAuthorityName:   buyHold.housingAuthorityName ?? null,
    }
  }

  // Linked buyer contact (from Contact CRM)
  const linkedBuyerContact = wholesale?.buyerContact ?? null
  const linkedBuyer: LinkedBuyerContact | null = linkedBuyerContact
    ? {
        id:    linkedBuyerContact.id,
        name:  [linkedBuyerContact.firstName, linkedBuyerContact.lastName].filter(Boolean).join(' ') || linkedBuyerContact.company || 'Buyer',
        email: linkedBuyerContact.email,
        phone: linkedBuyerContact.phone,
      }
    : null

  // Matching buyers — computed when in MARKETING stage with no buyer linked
  let matchingBuyers: MatchedBuyer[] = []
  if (isWholesale && deal.status === 'ACTIVE' && wholesale?.dispositionStatus === 'MARKETING' && !linkedBuyer) {
    const rawBuyers = await db.contact.findMany({
      where: { tenantId: tenant.id, type: 'BUYER', buyerProfile: { isActive: true } },
      include: { buyerProfile: true },
      take: 50,
    })
    const dealState = property.jurisdiction?.state ?? null
    const contractPriceNum = wholesale?.contractPrice != null ? Number(wholesale.contractPrice) : null
    const assignmentFeeNum = wholesale?.assignmentFee != null ? Number(wholesale.assignmentFee) : null

    matchingBuyers = rawBuyers
      .filter(b => {
        const p = b.buyerProfile
        if (!p) return false
        if (contractPriceNum != null && p.priceMax != null && contractPriceNum > Number(p.priceMax)) return false
        if (contractPriceNum != null && p.priceMin != null && contractPriceNum < Number(p.priceMin)) return false
        if (assignmentFeeNum != null && p.assignmentFeeMax != null && assignmentFeeNum > Number(p.assignmentFeeMax)) return false
        if (p.preferredStates.length > 0 && dealState && !p.preferredStates.includes(dealState)) return false
        return true
      })
      .slice(0, 8)
      .map(b => ({
        id:              b.id,
        name:            [b.firstName, b.lastName].filter(Boolean).join(' ') || b.company || 'Buyer',
        email:           b.email,
        phone:           b.phone,
        priceMax:        b.buyerProfile?.priceMax?.toString() ?? null,
        assignmentFeeMax: b.buyerProfile?.assignmentFeeMax?.toString() ?? null,
        preferredStates: b.buyerProfile?.preferredStates ?? [],
      }))
  }

  const wholesaleData: WholesaleData | null = isWholesale
    ? {
        dealId:             deal.id,
        dealStatus:         deal.status,
        leadSource:         wholesale?.leadSource ?? null,
        contractDate:       wholesale?.contractDate?.toISOString() ?? null,
        contractPrice:      wholesale?.contractPrice?.toString() ?? null,
        earnestMoney:       wholesale?.earnestMoney?.toString() ?? null,
        inspectionDeadline: wholesale?.inspectionDeadline?.toISOString() ?? null,
        closingDeadline:    wholesale?.closingDeadline?.toISOString() ?? null,
        assignmentFee:      wholesale?.assignmentFee?.toString() ?? null,
        buyerName:          wholesale?.buyerName ?? null,
        buyerEmail:         wholesale?.buyerEmail ?? null,
        buyerPhone:         wholesale?.buyerPhone ?? null,
        dispositionStatus:  wholesale?.dispositionStatus ?? null,
        marketingNotes:     wholesale?.marketingNotes ?? null,
        linkedBuyer,
        matchingBuyers,
      }
    : null
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
          {isLead && !isWholesale && !isFixFlip && !isBuyHold && (
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
        {/* Land section — replaces certificate card for LAND deals */}
        {isLand && landData ? (
          <DealLandSection dealId={deal.id} land={landData} acres={property.acres} economics={landEconomics} />
        ) : null}

        {/* Wholesale section — replaces certificate card for WHOLESALE deals */}
        {isWholesale && wholesaleData ? (
          <WholesaleSection data={wholesaleData} />
        ) : null}

        {/* Fix & Flip section — replaces certificate card for FIX_FLIP deals */}
        {isFixFlip && fixFlipData ? (
          <FixFlipSection data={fixFlipData} />
        ) : null}

        {/* Buy & Hold section — replaces certificate card for BUY_HOLD deals */}
        {isBuyHold && buyHoldData ? (
          <BuyHoldSection data={buyHoldData} />
        ) : null}

        {/* Multifamily section */}
        {isMultifamily && multifamilyData ? (
          <MultifamilySection data={multifamilyData} />
        ) : null}

        {/* Certificate / Lead details — hidden for land, wholesale, fix & flip, buy & hold, multifamily */}
        {!isLand && !isWholesale && !isFixFlip && !isBuyHold && !isMultifamily && <div className="bg-white rounded-xl border border-zinc-200 p-6">
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
        </div>}

        {/* Events */}
        {(isLead && !isLand && !isWholesale && !isFixFlip && !isBuyHold && !isMultifamily) ? (
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

      {/* MAO Calculator — wholesale only */}
      {isWholesale && (
        <div className="mb-6">
          <MaoCalculator
            prefillAssignmentFee={wholesale?.assignmentFee != null ? Number(wholesale.assignmentFee) : null}
            prefillContractPrice={wholesale?.contractPrice != null ? Number(wholesale.contractPrice) : null}
          />
        </div>
      )}

      {/* Rehab Budget — fix & flip only */}
      {isFixFlip && (
        <div className="mb-6">
          <RehabBudgetSection
            dealId={deal.id}
            initialScope={(fixFlip?.scopeOfWork ?? null) as ScopeOfWork | null}
          />
        </div>
      )}

      {/* Rental Expenses — buy & hold only */}
      {isBuyHold && (
        <div className="mb-6">
          <RentalExpensesSection
            dealId={deal.id}
            initialExpenses={(buyHold?.operatingExpenses ?? null) as RentalExpenses | null}
            monthlyRent={buyHold?.actualMonthlyRent != null ? Number(buyHold.actualMonthlyRent)
              : buyHold?.targetMonthlyRent != null ? Number(buyHold.targetMonthlyRent)
              : null}
          />
        </div>
      )}

      {/* Section 8 engine — buy & hold SECTION_8 strategy, PREMIUM tier */}
      {isSection8 && hasBuyHoldPremium && section8Data && (
        <div className="mb-6">
          <Section8Section data={section8Data} />
        </div>
      )}

      {/* Rent Roll + T12 + Business Plan — multifamily only */}
      {isMultifamily && (
        <div className="mb-6">
          <RentRollSection dealId={deal.id} initialRoll={mfRentRoll} />
          <T12Section
            dealId={deal.id}
            initialT12={mfT12}
            proFormaNoi={multifamily?.netOperatingIncome != null ? Number(multifamily.netOperatingIncome) : null}
          />
          <BusinessPlanSection
            dealId={deal.id}
            initialPlan={mfBusinessPlan}
            unitCount={multifamily?.unitCount ?? null}
            purchasePrice={deal.purchasePrice ? Number(deal.purchasePrice) : null}
            currentNoi={multifamily?.netOperatingIncome ? Number(multifamily.netOperatingIncome) : null}
          />
          <div className="mt-4 flex justify-end">
            <Link href={`/dashboard/deals/${deal.id}/print`} target="_blank"
              className="text-xs text-zinc-500 hover:text-zinc-900 underline transition-colors">
              Print / Investor Report ↗
            </Link>
          </div>
        </div>
      )}

      {/* Disposition funnel — land only, active deals */}
      {isLand && !isLead && (
        <div className="mb-6">
          <LandDispositionSection
            dealId={deal.id}
            dispositionStatus={land?.dispositionStatus ?? null}
            listedPrice={land?.listedPrice != null ? Number(land.listedPrice) : null}
            hasActiveNote={activeNote !== null}
            noteId={activeNote?.id ?? null}
          />
        </div>
      )}

      {/* Seller finance note — land only */}
      {isLand && (
        <div className="mb-6">
          <LandNoteSection dealId={deal.id} notes={noteRows} payments={notePayments} hasLandPremium={hasLandPremium} />
        </div>
      )}

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
        <DealTaskSection
          dealId={deal.id}
          initialTasks={dealTasks}
          hasChecklist={hasTemplate(deal.strategyType)}
        />
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
