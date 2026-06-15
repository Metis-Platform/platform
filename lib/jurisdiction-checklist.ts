import type { Priority, StrategyType, TaskType } from '@/app/generated/prisma'
import { buildResearchProfile, type ResearchProfile, type ResearchProfileField } from './jurisdiction-research'
import type { ChecklistTemplate } from './checklists/types'

type ProfileSource = Parameters<typeof buildResearchProfile>[0]

type TemplateItem = {
  key: string
  title: string
  verify: string
  office?: string
  taskType?: TaskType
  priority?: Priority
}

type RenderResult = {
  text: string
  missing: boolean
}

const STRATEGIES_WITH_JURISDICTION_CHECKLIST = new Set<StrategyType>([
  'TAX_LIEN',
  'TAX_DEED',
  'FORECLOSURE',
  'LAND',
  'WHOLESALE',
  'FIX_FLIP',
  'BUY_HOLD',
  'MULTIFAMILY',
])

const MATRIX: Record<StrategyType, TemplateItem[]> = {
  TAX_LIEN: [
    { key: 'redemption-period', title: 'Confirm redemption period: {{taxSale.redemptionPeriodMonths}} months', verify: 'redemption period', office: 'tax collector', taskType: 'REVIEW_REDEMPTION', priority: 'HIGH' },
    { key: 'interest-rate', title: 'Verify interest rate schedule: {{taxSale.interestRateSchedule}}', verify: 'interest rate schedule', office: 'tax collector', priority: 'HIGH' },
    { key: 'registration-deadline', title: 'Register for auction by {{taxSale.registrationDeadlineDays.value}} days before sale date', verify: 'auction registration deadline', office: 'auction platform', priority: 'HIGH' },
    { key: 'deposit', title: 'Confirm deposit requirement: {{taxSale.depositAmount}}', verify: 'deposit requirement', office: 'tax collector', priority: 'HIGH' },
    { key: 'bid-format', title: 'Note bid format: {{taxSale.bidFormat}}', verify: 'bid format', office: 'tax collector' },
    { key: 'otc', title: 'Verify OTC availability after sale: {{taxSale.otcAvailability}}', verify: 'OTC availability after sale', office: 'tax collector' },
    { key: 'deed-application', title: 'Identify deed application deadline and process: {{taxSale.deedApplicationProcess}}', verify: 'deed application deadline and process', office: 'tax collector', taskType: 'FILE_SUIT', priority: 'HIGH' },
    { key: 'foreclosure-budget', title: 'Budget for foreclosure: estimated {{taxSale.estimatedForeclosureCost}}', verify: 'estimated foreclosure cost', office: 'county clerk or attorney', priority: 'MEDIUM' },
    { key: 'quiet-title', title: 'Engage quiet title attorney if required - typical timeline/cost: {{taxSale.quietTitleTimelineCost}}', verify: 'quiet title requirement and timeline', office: 'county recorder or attorney', taskType: 'ORDER_TITLE_SEARCH', priority: 'MEDIUM' },
  ],
  TAX_DEED: [
    { key: 'sale-type', title: 'Confirm sale type and redeemability: {{taxSale.saleType}}', verify: 'sale type and redeemability', office: 'tax collector', priority: 'HIGH' },
    { key: 'redemption-period', title: 'Confirm redemption period if redeemable: {{taxSale.redemptionPeriodMonths}} months', verify: 'redemption period', office: 'tax collector', priority: 'HIGH' },
    { key: 'title-quality', title: 'Review title quality expectations: {{foreclosure.titleQualityExpectations}}', verify: 'title quality expectations', office: 'recorder', taskType: 'ORDER_TITLE_SEARCH', priority: 'HIGH' },
    { key: 'quiet-title', title: 'Confirm quiet title requirement: {{foreclosure.quietTitleRequirements}}', verify: 'quiet title requirement', office: 'recorder or attorney', priority: 'HIGH' },
    { key: 'recording-fees', title: 'Budget recording fees: {{recording.recordingFees}}', verify: 'recording fees', office: 'recorder', taskType: 'RECORD_DOCUMENT' },
    { key: 'transfer-tax', title: 'Budget transfer tax: {{recording.transferTaxRate}}', verify: 'transfer tax rate', office: 'recorder' },
    { key: 'deposit', title: 'Confirm auction deposit requirement: {{taxSale.depositAmount}}', verify: 'auction deposit requirement', office: 'auction platform', priority: 'HIGH' },
  ],
  FORECLOSURE: [
    { key: 'process-type', title: 'Confirm foreclosure process type: {{foreclosure.judicialOrNonJudicial}}', verify: 'judicial/non-judicial process type', office: 'clerk of court', priority: 'HIGH' },
    { key: 'timeline', title: 'Confirm NOD-to-auction timeline: {{foreclosure.nodToAuctionTimeline}}', verify: 'NOD-to-auction timeline', office: 'clerk of court', priority: 'HIGH' },
    { key: 'auction-format', title: 'Confirm auction location and format: {{taxSale.auctionLocation}}', verify: 'auction location and format', office: 'auction platform' },
    { key: 'deposit', title: 'Confirm auction deposit requirement: {{taxSale.depositAmount}}', verify: 'auction deposit requirement', office: 'auction platform', priority: 'HIGH' },
    { key: 'deposit-deadline', title: 'Confirm deposit deadline: {{taxSale.depositDeadline}}', verify: 'deposit deadline', office: 'auction platform', priority: 'HIGH' },
    { key: 'lien-survival', title: 'Review lien survival hierarchy: {{foreclosure.lienSurvivalHierarchy}}', verify: 'lien survival hierarchy', office: 'recorder', taskType: 'ORDER_TITLE_SEARCH', priority: 'HIGH' },
  ],
  LAND: [
    { key: 'res-lot-size', title: 'Verify residential minimum lot size: {{zoning.minLotSizeResidential}}', verify: 'residential minimum lot size', office: 'planning/zoning', priority: 'HIGH' },
    { key: 'ag-lot-size', title: 'Verify agricultural minimum lot size: {{zoning.minLotSizeAgricultural}}', verify: 'agricultural minimum lot size', office: 'planning/zoning' },
    { key: 'setbacks', title: 'Confirm setback requirements: {{zoning.setbackRequirements}}', verify: 'setback requirements', office: 'planning/zoning' },
    { key: 'variance', title: 'Confirm variance process: {{zoning.varianceProcess}}', verify: 'variance process', office: 'planning/zoning' },
    { key: 'perc', title: 'Determine whether perc test is required: {{physical.percTestRequired}}', verify: 'perc test requirement', office: 'health department' },
    { key: 'well', title: 'Confirm well drilling regulations: {{physical.wellDrillingRegulations}}', verify: 'well drilling regulations', office: 'health department' },
    { key: 'zoning-portal', title: 'Check zoning compatibility at {{zoning.zoningPortalUrl}}', verify: 'zoning portal URL', office: 'planning/zoning' },
  ],
  WHOLESALE: [
    { key: 'assignment-legality', title: 'Review assignment contract legality: {{wholesale.assignmentContractLegality}}', verify: 'assignment contract legality', office: 'state real estate commission', priority: 'HIGH' },
    { key: 'disclosure', title: 'Confirm assignment disclosure requirements: {{wholesale.assignmentDisclosureRequired}}', verify: 'assignment disclosure requirements', office: 'state real estate commission', priority: 'HIGH' },
    { key: 'double-close', title: 'Confirm double-close norms: {{wholesale.doubleClosingAllowed}}', verify: 'double-close norms', office: 'title company' },
    { key: 'closing-norm', title: 'Note days-to-close norm: {{wholesale.daysToCloseNorm}}', verify: 'days-to-close norm', office: 'title company' },
    { key: 'transfer-tax', title: 'Budget transfer tax: {{recording.transferTaxRate}}', verify: 'transfer tax rate', office: 'recorder' },
    { key: 'recorder', title: 'Save recorder contact: {{contacts.recorder}}', verify: 'recorder contact', office: 'recorder' },
  ],
  FIX_FLIP: [
    { key: 'permits-office', title: 'Pull permits - office: {{contacts.buildingPermits.website}}', verify: 'building permit office', office: 'building permits', priority: 'HIGH' },
    { key: 'permit-timeline', title: 'Expected permit timeline: {{permits.avgPermitTimelineSimpleReno}}', verify: 'simple renovation permit timeline', office: 'building permits', priority: 'HIGH' },
    { key: 'contractor-license', title: 'Verify contractor licensing requirements: {{permits.contractorLicensingRequirements}}', verify: 'contractor licensing requirements', office: 'building permits', priority: 'HIGH' },
    { key: 'inspection', title: 'Confirm inspection process: {{permits.inspectionProcess}}', verify: 'inspection process', office: 'building permits' },
    { key: 'co', title: 'Confirm CO requirements: {{permits.certificateOfOccupancyRequirements}}', verify: 'certificate of occupancy requirements', office: 'building permits' },
    { key: 'transfer-tax', title: 'Budget transfer tax: {{recording.transferTaxRate}}', verify: 'transfer tax rate', office: 'recorder' },
    { key: 'flood-zone', title: 'Check flood zone status: {{physical.femaFloodZoneMapUrl}}', verify: 'FEMA flood zone lookup', office: 'GIS' },
    { key: 'zoning', title: 'Check zoning compatibility at {{zoning.zoningPortalUrl}}', verify: 'zoning portal URL', office: 'planning/zoning' },
  ],
  BUY_HOLD: [
    { key: 'rent-control', title: 'Review rent control status: {{landlordTenant.rentControlStatus}}', verify: 'rent control status', office: 'housing authority', priority: 'HIGH' },
    { key: 'just-cause', title: 'Confirm just-cause eviction requirement: {{landlordTenant.justCauseEvictionRequired}}', verify: 'just-cause eviction requirement', office: 'housing authority' },
    { key: 'eviction', title: 'Understand eviction process: {{landlordTenant.evictionProcessTimeline}}', verify: 'eviction process timeline', office: 'clerk of court', priority: 'HIGH' },
    { key: 'deposit-limits', title: 'Confirm security deposit limits: {{landlordTenant.securityDepositLimits}}', verify: 'security deposit limits', office: 'housing authority' },
    { key: 'str', title: 'Check STR regulations if considering short-term rental: {{zoning.strZoningRules}}', verify: 'short-term rental regulations', office: 'planning/zoning' },
    { key: 'section8-contact', title: 'Contact HCV office if Section 8: {{contacts.section8}}', verify: 'HCV administrator contact', office: 'housing authority' },
    { key: 'hqs', title: 'Confirm HQS inspection timeline: {{section8.hqsInspectionTimeline}}', verify: 'HQS inspection timeline', office: 'housing authority' },
  ],
  MULTIFAMILY: [
    { key: 'zoning-lot', title: 'Verify multifamily minimum lot size: {{zoning.minLotSizeResidential}}', verify: 'multifamily minimum lot size', office: 'planning/zoning', priority: 'HIGH' },
    { key: 'height', title: 'Confirm height restrictions: {{zoning.heightRestrictions}}', verify: 'height restrictions', office: 'planning/zoning' },
    { key: 'coverage', title: 'Confirm coverage ratio: {{zoning.coverageRatio}}', verify: 'coverage ratio', office: 'planning/zoning' },
    { key: 'fmr-source', title: 'Confirm FMR data source: {{section8.fmrDataSource}}', verify: 'FMR data source', office: 'housing authority' },
    { key: 'hcv-contact', title: 'Save HCV administrator contact: {{contacts.section8}}', verify: 'HCV administrator contact', office: 'housing authority' },
    { key: 'rent-control', title: 'Review rent control status: {{landlordTenant.rentControlStatus}}', verify: 'rent control status', office: 'housing authority', priority: 'HIGH' },
    { key: 'str', title: 'Check STR regulations: {{zoning.strZoningRules}}', verify: 'short-term rental regulations', office: 'planning/zoning' },
  ],
}

function fieldFor(profile: ResearchProfile, path: string): ResearchProfileField | null {
  const [section, key] = path.split('.')
  if (!section || !key) return null
  return profile[section as keyof ResearchProfile]?.[key] ?? null
}

function citationLabel(citation: unknown): string | null {
  if (!citation) return null
  if (typeof citation === 'string') return citation
  if (typeof citation === 'object' && citation !== null) {
    const label = (citation as Record<string, unknown>).label
    if (typeof label === 'string' && label.length > 0) return label
  }
  return null
}

function valueText(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) return value.length ? value.join(', ') : null
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== null && item !== undefined && item !== '')
      .map(([key, item]) => `${key}: ${String(item)}`)
    return entries.length ? entries.join('; ') : null
  }
  return String(value)
}

function resolvePlaceholder(profile: ResearchProfile, expression: string): string | null {
  const parts = expression.split('.')
  if (parts.length < 2) return null

  const field = fieldFor(profile, `${parts[0]}.${parts[1]}`)
  if (!field) return null

  const selector = parts.slice(2).join('.')
  if (!selector) {
    const text = valueText(field.value)
    if (!text) return null
    const citation = citationLabel(field.citation)
    return citation ? `${text} [${citation}]` : text
  }

  if (selector === 'value') return valueText(field.value)
  if (selector === 'citation') return citationLabel(field.citation)

  if (typeof field.value === 'object' && field.value !== null && !Array.isArray(field.value)) {
    return valueText((field.value as Record<string, unknown>)[selector])
  }

  return null
}

export function renderJurisdictionChecklistTitle(
  template: string,
  profileSource: ProfileSource,
  verifyLabel: string,
  office = 'the relevant county office',
): RenderResult {
  const profile = buildResearchProfile(profileSource)
  let missing = false
  const text = template.replace(/\{\{([^}]+)\}\}/g, (_match, rawExpression: string) => {
    const resolved = resolvePlaceholder(profile, rawExpression.trim())
    if (!resolved) {
      missing = true
      return ''
    }
    return resolved
  }).replace(/\s+/g, ' ').trim()

  if (missing || text.length === 0) {
    return {
      text: `Verify ${verifyLabel} with ${office}`,
      missing: true,
    }
  }

  return { text, missing: false }
}

export function hasJurisdictionChecklistTemplate(strategy: StrategyType): boolean {
  return STRATEGIES_WITH_JURISDICTION_CHECKLIST.has(strategy)
}

export function buildJurisdictionChecklistTemplate(
  strategy: StrategyType,
  profileSource: ProfileSource,
): ChecklistTemplate | null {
  const items = MATRIX[strategy]
  if (!items) return null

  return {
    strategy,
    label: 'Due Diligence',
    items: items.map((item) => {
      const rendered = renderJurisdictionChecklistTitle(item.title, profileSource, item.verify, item.office)
      return {
        key: `jurisdiction-dd-${strategy.toLowerCase()}-${item.key}`,
        title: rendered.text,
        description: rendered.missing
          ? 'Jurisdiction profile data is missing or unverified; confirm this item manually and update the deal notes or jurisdiction profile.'
          : 'Generated from the jurisdiction profile. Verify against the cited county or state source before relying on it.',
        taskType: item.taskType ?? 'CUSTOM',
        defaultPriority: rendered.missing ? 'MEDIUM' : item.priority ?? 'MEDIUM',
      }
    }),
  }
}

