export type ProfileFieldValue = string | number | boolean | string[]

export type ProfileField<T = ProfileFieldValue> = {
  value: T
  claimId?: string
  questionId?: string
  questionSchemaVersion?: string
  authorityClass?: string
  expectedAuthorityClass?: string
  sourceAuthorityClass?: string
  sourceAuthorityOwner?: string
  sourceAuthorityStatus?: 'UNVERIFIED' | 'VERIFIED' | 'REJECTED'
  sourceAuthorityVerifiedAt?: string
  sourceAuthorityVerifiedBy?: string
  verificationState?: 'REVIEWED' | 'VERIFIED' | 'STALE' | 'BLOCKED'
  sourceUrl?: string
  citation?: string
  retrievedAt?: string
  effectiveAt?: string
  geographicScope?: string
  verifiedAt: string
  confidence: number
  verifiedById?: string
  volatility: 'static' | 'annual' | 'per_sale' | 'quarterly'
  freshnessConfirmedAt?: string
  reviewDueAt?: string
  staleAt?: string
  freshnessPolicyVersion?: string
}

export const JURISDICTION_PROFILE_SECTIONS = [
  'taxSale',
  'foreclosure',
  'recording',
  'zoning',
  'physical',
  'permits',
  'landlordTenant',
  'section8',
  'wholesale',
  'marketSignals',
  'contacts',
] as const

export type JurisdictionProfileSection = typeof JURISDICTION_PROFILE_SECTIONS[number]
export type ProfileSectionRecord = Record<string, ProfileField>

export type TaxSaleProfile = ProfileSectionRecord
export type ForeclosureProfile = ProfileSectionRecord
export type RecordingProfile = ProfileSectionRecord
export type ZoningProfile = ProfileSectionRecord
export type PhysicalProfile = ProfileSectionRecord
export type PermitsProfile = ProfileSectionRecord
export type LandlordTenantProfile = ProfileSectionRecord
export type Section8Profile = ProfileSectionRecord
export type WholesaleProfile = ProfileSectionRecord
export type MarketSignalsProfile = ProfileSectionRecord

export type ContactProfileField = ProfileField<{
  name?: string
  phone?: string
  email?: string
  website?: string
}>
export type ContactsProfile = Record<string, ContactProfileField>

export type JurisdictionProfileSections = {
  taxSale: TaxSaleProfile
  foreclosure: ForeclosureProfile
  recording: RecordingProfile
  zoning: ZoningProfile
  physical: PhysicalProfile
  permits: PermitsProfile
  landlordTenant: LandlordTenantProfile
  section8: Section8Profile
  wholesale: WholesaleProfile
  marketSignals: MarketSignalsProfile
  contacts: ContactsProfile
}

export type ProfileFieldUpdate = {
  section: JurisdictionProfileSection
  fieldKey: string
  field: ProfileField
}

export function isJurisdictionProfileSection(section: string): section is JurisdictionProfileSection {
  return JURISDICTION_PROFILE_SECTIONS.includes(section as JurisdictionProfileSection)
}

export function applyProfileFieldUpdate<T extends Partial<JurisdictionProfileSections>>(
  existing: T,
  update: ProfileFieldUpdate
): T & Pick<JurisdictionProfileSections, typeof update.section> {
  if (!isJurisdictionProfileSection(update.section)) {
    throw new Error('Invalid jurisdiction profile section')
  }

  const currentSection = (existing[update.section] ?? {}) as ProfileSectionRecord

  return {
    ...existing,
    [update.section]: {
      ...currentSection,
      [update.fieldKey]: update.field,
    },
  } as T & Pick<JurisdictionProfileSections, typeof update.section>
}

export function publishProfileSection(
  publishedSections: string[],
  section: JurisdictionProfileSection
): string[] {
  if (!isJurisdictionProfileSection(section)) {
    throw new Error('Invalid jurisdiction profile section')
  }
  if (publishedSections.includes(section)) return publishedSections
  return [...publishedSections, section]
}
