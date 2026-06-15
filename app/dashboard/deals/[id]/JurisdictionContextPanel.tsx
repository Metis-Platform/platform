import Link from 'next/link'
import type { ResearchFieldDef, ResearchProfile, ResearchProfileField, ResearchStrategy } from '@/lib/jurisdiction-research'

type ContextEvent = {
  eventType: string
  label: string
  dueDate: string
  status: string
}

type Props = {
  strategy: ResearchStrategy
  status: string
  jurisdiction: {
    id: string
    county: string
    stateName: string
  }
  profile: ResearchProfile | null
  events: ContextEvent[]
  section8InPlay?: boolean
}

type ContextField = ResearchFieldDef & {
  urgent?: boolean
}

const STRATEGY_LABELS: Record<ResearchStrategy, string> = {
  TAX_LIEN: 'Tax Lien',
  TAX_DEED: 'Tax Deed',
  FORECLOSURE: 'Foreclosure',
  LAND: 'Land',
  WHOLESALE: 'Wholesale',
  FIX_FLIP: 'Fix & Flip',
  BUY_HOLD: 'Buy & Hold',
  MULTIFAMILY: 'Multifamily',
}

function field(section: ResearchFieldDef['section'], key: string, label: string, urgent = false): ContextField {
  return { section, key, label, urgent }
}

function daysUntil(date: string) {
  const dueDate = new Date(date)
  if (Number.isNaN(dueDate.getTime())) return null
  return Math.ceil((dueDate.getTime() - Date.now()) / 86_400_000)
}

function hasApproachingEvent(events: ContextEvent[], eventTypes: string[]) {
  return events.some((event) => {
    if (!eventTypes.includes(event.eventType)) return false
    if (event.status === 'COMPLETED' || event.status === 'SKIPPED') return false
    const days = daysUntil(event.dueDate)
    return days !== null && days >= 0 && days <= 90
  })
}

function approachingEvents(events: ContextEvent[], eventTypes: string[]) {
  return events
    .filter((event) => eventTypes.includes(event.eventType) && event.status !== 'COMPLETED' && event.status !== 'SKIPPED')
    .map((event) => ({ ...event, days: daysUntil(event.dueDate) }))
    .filter((event): event is ContextEvent & { days: number } => event.days !== null && event.days >= 0 && event.days <= 90)
}

function contextFields(strategy: ResearchStrategy, status: string, events: ContextEvent[], section8InPlay: boolean): ContextField[] {
  const approachingRedemption = hasApproachingEvent(events, ['REDEMPTION_DEADLINE', 'FORECLOSURE_ELIGIBLE'])
  const approachingAuction = hasApproachingEvent(events, ['AUCTION_DATE', 'TAX_SALE'])

  if (strategy === 'TAX_LIEN') {
    if (status === 'FORECLOSURE_INITIATED') {
      return [
        field('foreclosure', 'quietTitleRequirements', 'Quiet title requirements', true),
        field('foreclosure', 'titleQualityExpectations', 'Title quality expectations', true),
        field('contacts', 'recorder', 'Recorder contact'),
      ]
    }

    return [
      field('taxSale', 'redemptionPeriodMonths', 'Redemption period'),
      field('taxSale', 'interestRateSchedule', 'Interest rate schedule'),
      field('taxSale', 'noticeRequirements', 'Notice requirements'),
      ...(status === 'ACTIVE' && approachingRedemption ? [
        field('taxSale', 'deedApplicationProcess', 'Deed / foreclosure application process', true),
        field('taxSale', 'applicationDeadline', 'Application deadline', true),
        field('taxSale', 'estimatedForeclosureCost', 'Estimated foreclosure cost', true),
      ] : []),
    ]
  }

  if (strategy === 'TAX_DEED') {
    if (status === 'DEEDED') {
      return [
        field('recording', 'recordingFees', 'Recording fees'),
        field('recording', 'transferTaxRate', 'Transfer tax rate'),
        field('contacts', 'recorder', 'Recorder contact'),
      ]
    }

    return [
      field('taxSale', 'redemptionPeriodMonths', 'Redemption period'),
      field('foreclosure', 'titleQualityExpectations', 'Title quality expectations'),
      field('foreclosure', 'quietTitleRequirements', 'Quiet title required'),
    ]
  }

  if (strategy === 'FORECLOSURE') {
    return [
      field('foreclosure', 'judicialOrNonJudicial', 'Judicial / non-judicial'),
      field('foreclosure', 'nodToAuctionTimeline', 'NOD-to-auction timeline'),
      field('taxSale', 'depositAmount', 'Auction deposit requirement'),
      field('foreclosure', 'lienSurvivalHierarchy', 'Lien survival hierarchy'),
      ...(status === 'ACTIVE' && approachingAuction ? [
        field('taxSale', 'auctionLocation', 'Auction location / format', true),
        field('taxSale', 'depositDeadline', 'Deposit deadline', true),
      ] : []),
    ]
  }

  if (strategy === 'LAND') {
    return [
      field('zoning', 'minLotSizeResidential', 'Minimum lot size - residential'),
      field('zoning', 'minLotSizeAgricultural', 'Minimum lot size - agricultural'),
      field('zoning', 'setbackRequirements', 'Setback requirements'),
      field('zoning', 'varianceProcess', 'Variance process'),
      field('physical', 'percTestRequired', 'Perc test required'),
      field('physical', 'wellDrillingRegulations', 'Well drilling regulations'),
      field('zoning', 'zoningPortalUrl', 'Zoning portal'),
    ]
  }

  if (strategy === 'WHOLESALE') {
    return [
      field('wholesale', 'assignmentContractLegality', 'Assignment contract legality'),
      field('wholesale', 'doubleClosingAllowed', 'Double-close norms'),
      field('wholesale', 'assignmentDisclosureRequired', 'Disclosure requirements'),
      field('contacts', 'recorder', 'Recorder contact'),
    ]
  }

  if (strategy === 'FIX_FLIP') {
    return [
      ...(status === 'ACTIVE' ? [
        field('permits', 'permitOfficeUrl', 'Permit office'),
        field('permits', 'avgPermitTimelineSimpleReno', 'Average permit timeline'),
        field('permits', 'contractorLicensingRequirements', 'Contractor licensing requirements'),
        field('permits', 'inspectionProcess', 'Inspection process'),
        field('permits', 'certificateOfOccupancyRequirements', 'CO requirements'),
      ] : []),
      field('recording', 'transferTaxRate', 'Transfer tax rate'),
      field('recording', 'recordingFees', 'Recording fees'),
    ]
  }

  if (strategy === 'BUY_HOLD') {
    return [
      field('landlordTenant', 'rentControlStatus', 'Rent control status'),
      field('landlordTenant', 'justCauseEvictionRequired', 'Just-cause eviction required'),
      field('landlordTenant', 'evictionProcessTimeline', 'Eviction process timeline'),
      field('landlordTenant', 'securityDepositLimits', 'Security deposit limits'),
      field('zoning', 'strZoningRules', 'STR regulations'),
      ...(section8InPlay ? [
        field('contacts', 'section8', 'HCV administrator contact', true),
        field('section8', 'hqsInspectionTimeline', 'HQS inspection timeline', true),
      ] : []),
    ]
  }

  return [
    field('zoning', 'minLotSizeResidential', 'Minimum lot size'),
    field('zoning', 'heightRestrictions', 'Height restrictions'),
    field('zoning', 'coverageRatio', 'Coverage ratio'),
    field('section8', 'fmrDataSource', 'FMR data source'),
    field('contacts', 'section8', 'HCV administrator'),
    field('landlordTenant', 'rentControlStatus', 'Rent control status'),
    field('zoning', 'strZoningRules', 'STR regulations'),
  ]
}

function profileField(profile: ResearchProfile | null, def: ResearchFieldDef): ResearchProfileField | null {
  return profile?.[def.section]?.[def.key] ?? null
}

function isPresent(fieldValue: ResearchProfileField | null) {
  const value = fieldValue?.value
  return value !== null && value !== undefined && value !== ''
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'Not yet verified'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) return value.length ? value.join(', ') : 'Not yet verified'
  if (typeof value === 'number') return Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined, { maximumFractionDigits: 2 })
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== null && item !== undefined && item !== '')
      .map(([key, item]) => `${labelize(key)}: ${String(item)}`)
    return entries.length ? entries.join(' | ') : 'Not yet verified'
  }
  return String(value)
}

function labelize(value: string) {
  return value
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function isSafeExternalUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

function contactLinks(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const phone = typeof record.phone === 'string' ? record.phone : null
  const email = typeof record.email === 'string' ? record.email : null
  const website = typeof record.website === 'string' && isSafeExternalUrl(record.website) ? record.website : null
  if (!phone && !email && !website) return null

  return (
    <span className="mt-1 flex flex-wrap gap-2 text-xs">
      {phone && <a href={`tel:${phone}`} className="font-medium text-blue-700 hover:text-blue-900">{phone}</a>}
      {email && <a href={`mailto:${email}`} className="font-medium text-blue-700 hover:text-blue-900">{email}</a>}
      {website && <a href={website} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-700 hover:text-blue-900">Website</a>}
    </span>
  )
}

function sourceLink(fieldValue: ResearchProfileField | null) {
  if (!fieldValue?.sourceUrl || !isSafeExternalUrl(fieldValue.sourceUrl)) return null
  return (
    <a href={fieldValue.sourceUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-700 hover:text-blue-900">
      Source
    </a>
  )
}

export default function JurisdictionContextPanel({
  strategy,
  status,
  jurisdiction,
  profile,
  events,
  section8InPlay = false,
}: Props) {
  const fields = contextFields(strategy, status, events, section8InPlay)
  const visibleFields = fields.map((def) => ({ def, value: profileField(profile, def) }))
  const hasAnyProfileData = visibleFields.some((item) => isPresent(item.value))
  const urgentEvents = approachingEvents(events, strategy === 'FORECLOSURE' ? ['AUCTION_DATE', 'TAX_SALE'] : ['REDEMPTION_DEADLINE', 'FORECLOSURE_ELIGIBLE'])

  return (
    <details className="group mb-6 rounded-xl border border-zinc-200 bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-6">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">
            <span aria-hidden="true">📍</span> {jurisdiction.county} County - {STRATEGY_LABELS[strategy]} Context
          </h2>
          <p className="mt-1 text-xs text-zinc-500">Stage-aware local rules and contacts for this deal.</p>
        </div>
        <span className="text-xs font-medium text-blue-600 group-open:hidden">Show</span>
        <span className="hidden text-xs font-medium text-blue-600 group-open:inline">Hide</span>
      </summary>

      <div className="border-t border-zinc-100 px-6 pb-6 pt-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Link href={`/dashboard/jurisdictions/${jurisdiction.id}`} className="text-sm font-medium text-blue-700 hover:text-blue-900">
            View full jurisdiction profile
          </Link>
          {urgentEvents.length > 0 && (
            <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
              {urgentEvents[0].label} due in {urgentEvents[0].days} days
            </span>
          )}
        </div>

        {!hasAnyProfileData && (
          <div className="mb-4 rounded-lg border border-dashed border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Research for this county is in progress. View what&apos;s available in the full jurisdiction profile.
          </div>
        )}

        <dl className="space-y-3 text-sm">
          {visibleFields.map(({ def, value }) => (
            <div
              key={`${def.section}.${def.key}`}
              className={def.urgent ? 'rounded-lg border border-red-200 bg-red-50 p-3' : 'rounded-lg border border-zinc-200 p-3'}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <dt className={def.urgent ? 'font-semibold text-red-900' : 'font-medium text-zinc-600'}>{def.label}</dt>
                <dd className={isPresent(value) ? 'text-zinc-900 sm:max-w-md sm:text-right' : 'italic text-zinc-400 sm:max-w-md sm:text-right'}>
                  {formatValue(value?.value)}
                  {contactLinks(value?.value)}
                </dd>
              </div>
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-zinc-500">
                <span>{def.section}.{def.key}</span>
                {sourceLink(value)}
                {value?.confidence !== undefined && <span>Confidence {Math.round(value.confidence * 100)}%</span>}
              </div>
            </div>
          ))}
        </dl>
      </div>
    </details>
  )
}

