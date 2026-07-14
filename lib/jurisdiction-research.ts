import { JURISDICTION_PROFILE_SECTIONS, type JurisdictionProfileSection, type ProfileField } from './jurisdiction-profile'

export type ResearchStrategy =
  | 'TAX_LIEN'
  | 'TAX_DEED'
  | 'FORECLOSURE'
  | 'LAND'
  | 'WHOLESALE'
  | 'FIX_FLIP'
  | 'BUY_HOLD'
  | 'MULTIFAMILY'

export type ResearchFieldDef = {
  section: JurisdictionProfileSection
  key: string
  label: string
}

export type ResearchProfileField = Omit<ProfileField, 'citation'> & {
  citation?: unknown
}

export type ResearchProfile = Record<JurisdictionProfileSection, Record<string, ResearchProfileField>>

export const RESEARCH_STRATEGIES: { key: ResearchStrategy; label: string }[] = [
  { key: 'TAX_LIEN', label: 'Tax Lien' },
  { key: 'TAX_DEED', label: 'Tax Deed' },
  { key: 'FORECLOSURE', label: 'Foreclosure' },
  { key: 'LAND', label: 'Land' },
  { key: 'WHOLESALE', label: 'Wholesale' },
  { key: 'FIX_FLIP', label: 'Fix & Flip' },
  { key: 'BUY_HOLD', label: 'Buy & Hold' },
  { key: 'MULTIFAMILY', label: 'Multifamily' },
]

export const STRATEGY_RESEARCH_FIELDS: Record<ResearchStrategy, ResearchFieldDef[]> = {
  TAX_LIEN: [
    { section: 'taxSale', key: 'saleType', label: 'Sale type' },
    { section: 'taxSale', key: 'bidFormat', label: 'Bid format' },
    { section: 'taxSale', key: 'redemptionPeriodMonths', label: 'Redemption period' },
    { section: 'taxSale', key: 'interestRateSchedule', label: 'Interest / penalty schedule' },
    { section: 'taxSale', key: 'saleSchedule', label: 'Sale schedule' },
    { section: 'taxSale', key: 'depositAmount', label: 'Deposit amount' },
    { section: 'taxSale', key: 'onlinePlatform', label: 'Online platform' },
    { section: 'taxSale', key: 'noticeRequirements', label: 'Notice requirements' },
    { section: 'taxSale', key: 'deedApplicationProcess', label: 'Deed application process' },
    { section: 'taxSale', key: 'overTheCounterAvailable', label: 'Over-the-counter availability' },
    { section: 'taxSale', key: 'otcAvailability', label: 'OTC notes' },
  ],
  TAX_DEED: [
    { section: 'taxSale', key: 'saleType', label: 'Sale type' },
    { section: 'taxSale', key: 'bidFormat', label: 'Bid format' },
    { section: 'taxSale', key: 'saleSchedule', label: 'Sale schedule' },
    { section: 'taxSale', key: 'depositAmount', label: 'Deposit amount' },
    { section: 'taxSale', key: 'onlinePlatform', label: 'Online platform' },
    { section: 'taxSale', key: 'noticeRequirements', label: 'Notice requirements' },
    { section: 'taxSale', key: 'overTheCounterAvailable', label: 'Over-the-counter availability' },
    { section: 'recording', key: 'deedRecordingTimeline', label: 'Deed recording timeline' },
    { section: 'recording', key: 'transferTaxRate', label: 'Transfer tax rate' },
    { section: 'foreclosure', key: 'lienSurvivalHierarchy', label: 'Lien survival hierarchy' },
  ],
  FORECLOSURE: [
    { section: 'foreclosure', key: 'judicialOrNonJudicial', label: 'Judicial / non-judicial' },
    { section: 'foreclosure', key: 'timelineDays', label: 'Typical timeline' },
    { section: 'foreclosure', key: 'noticeOfDefaultDays', label: 'Notice of default timing' },
    { section: 'foreclosure', key: 'postSaleRedemptionDays', label: 'Post-sale redemption' },
    { section: 'foreclosure', key: 'publicationRequirements', label: 'Publication requirements' },
    { section: 'foreclosure', key: 'lienSurvivalHierarchy', label: 'Lien survival hierarchy' },
    { section: 'recording', key: 'recordingOfficeUrl', label: 'Recording office' },
  ],
  LAND: [
    { section: 'zoning', key: 'commonZoning', label: 'Common zoning classifications' },
    { section: 'zoning', key: 'zoningMapUrl', label: 'Zoning map' },
    { section: 'zoning', key: 'strZoningRules', label: 'Short-term rental zoning' },
    { section: 'physical', key: 'floodplainLookupUrl', label: 'Floodplain lookup' },
    { section: 'physical', key: 'wetlandsBody', label: 'Wetlands review body' },
    { section: 'physical', key: 'septicWellRules', label: 'Septic / well rules' },
    { section: 'recording', key: 'optionRecordingRequired', label: 'Option recording requirement' },
  ],
  WHOLESALE: [
    { section: 'wholesale', key: 'assignmentContractLegality', label: 'Assignment contract legality' },
    { section: 'wholesale', key: 'assignmentDisclosureRequired', label: 'Assignment disclosure required' },
    { section: 'wholesale', key: 'doubleClosingAllowed', label: 'Double closing allowed' },
    { section: 'wholesale', key: 'daysToCloseNorm', label: 'Days-to-close norm' },
    { section: 'wholesale', key: 'earnestMoneyPct', label: 'Earnest money norm' },
    { section: 'recording', key: 'transferTaxRate', label: 'Transfer tax rate' },
  ],
  FIX_FLIP: [
    { section: 'permits', key: 'permitOfficeUrl', label: 'Permit office' },
    { section: 'permits', key: 'avgPermitTimelineSimpleReno', label: 'Simple renovation permit timeline' },
    { section: 'permits', key: 'contractorLicensingRequirements', label: 'Contractor licensing requirements' },
    { section: 'recording', key: 'transferTaxRate', label: 'Transfer tax rate' },
    { section: 'foreclosure', key: 'judicialOrNonJudicial', label: 'Foreclosure process' },
    { section: 'contacts', key: 'buildingPermits', label: 'Building permits contact' },
  ],
  BUY_HOLD: [
    { section: 'landlordTenant', key: 'rentControlStatus', label: 'Rent control status' },
    { section: 'landlordTenant', key: 'justCauseEvictionRequired', label: 'Just-cause eviction required' },
    { section: 'landlordTenant', key: 'evictionNoticeDays', label: 'Eviction notice period' },
    { section: 'section8', key: 'section8Available', label: 'Section 8 availability' },
    { section: 'section8', key: 'paymentStandardUrl', label: 'Payment standards' },
    { section: 'marketSignals', key: 'avgCapRatePct', label: 'Average cap rate' },
    { section: 'marketSignals', key: 'rentalVacancyRatePct', label: 'Rental vacancy rate' },
    { section: 'zoning', key: 'strZoningRules', label: 'Short-term rental zoning' },
  ],
  MULTIFAMILY: [
    { section: 'landlordTenant', key: 'rentControlStatus', label: 'Rent control status' },
    { section: 'landlordTenant', key: 'justCauseEvictionRequired', label: 'Just-cause eviction required' },
    { section: 'section8', key: 'section8Available', label: 'Section 8 availability' },
    { section: 'marketSignals', key: 'avgCapRatePct', label: 'Average cap rate' },
    { section: 'marketSignals', key: 'medianPropertyValue', label: 'Median property value' },
    { section: 'marketSignals', key: 'investorPurchaseSharePct', label: 'Investor purchase share' },
    { section: 'permits', key: 'aduByRight', label: 'ADU allowed by right' },
    { section: 'zoning', key: 'multifamilyZoningNotes', label: 'Multifamily zoning notes' },
  ],
}

export const MARKET_SIGNAL_FIELDS: ResearchFieldDef[] = [
  { section: 'marketSignals', key: 'opportunityScore', label: 'Opportunity score' },
  { section: 'marketSignals', key: 'saturationScore', label: 'Saturation score' },
  { section: 'marketSignals', key: 'medianPropertyValue', label: 'Median value' },
  { section: 'marketSignals', key: 'avgCapRatePct', label: 'Average cap rate' },
  { section: 'marketSignals', key: 'fixFlipRatePct', label: 'Flip rate' },
  { section: 'marketSignals', key: 'investorPurchaseSharePct', label: 'Investor share' },
]

export const CONTACT_FIELDS: ResearchFieldDef[] = [
  { section: 'contacts', key: 'assessor', label: 'Assessor' },
  { section: 'contacts', key: 'taxCollector', label: 'Tax collector' },
  { section: 'contacts', key: 'recorder', label: 'Recorder' },
  { section: 'contacts', key: 'gis', label: 'GIS' },
  { section: 'contacts', key: 'planning', label: 'Planning / zoning' },
  { section: 'contacts', key: 'buildingPermits', label: 'Building permits' },
  { section: 'contacts', key: 'section8', label: 'Section 8 / PHA' },
]

function profileSection(value: unknown): Record<string, ResearchProfileField> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, ResearchProfileField>
}

export function buildResearchProfile(profile: {
  [K in JurisdictionProfileSection]?: unknown
} | null | undefined): ResearchProfile {
  return Object.fromEntries(
    JURISDICTION_PROFILE_SECTIONS.map((section) => [section, profileSection(profile?.[section])])
  ) as ResearchProfile
}

export function blockContradictoryResearchFields(
  profile: ResearchProfile,
  fields: Array<{ section: JurisdictionProfileSection; fieldKey: string }>,
): ResearchProfile {
  if (fields.length === 0) return profile
  const next = { ...profile }
  for (const { section, fieldKey } of fields) {
    const field = next[section][fieldKey]
    if (!field?.claimId) continue
    next[section] = {
      ...next[section],
      [fieldKey]: { ...field, verificationState: 'BLOCKED' },
    }
  }
  return next
}
