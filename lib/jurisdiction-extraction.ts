import { createHash } from 'crypto'
import Anthropic from '@anthropic-ai/sdk'
import type { JurisdictionProfileSection } from './jurisdiction-profile'
import { assertSideEffectAllowed, type RuntimeEnvironment } from './side-effect-policy'

export type ExtractionResult = {
  section: JurisdictionProfileSection
  fieldKey: string
  value: string | number | boolean
  confidence: number
  sourceSnippet: string
  volatility: 'static' | 'annual' | 'per_sale' | 'quarterly'
  notes?: string
}

type FieldSpec = {
  section: JurisdictionProfileSection
  fieldKey: string
  description: string
  volatility: 'static' | 'annual' | 'per_sale' | 'quarterly'
}

export const OFFICE_TYPE_FIELDS: Record<string, FieldSpec[]> = {
  tax_collector: [
    { section: 'taxSale', fieldKey: 'saleType', description: 'Type of tax sale: lien, deed, or redeemable_deed', volatility: 'static' },
    { section: 'taxSale', fieldKey: 'saleFrequency', description: 'How often tax sales occur (e.g., annually, monthly)', volatility: 'annual' },
    { section: 'taxSale', fieldKey: 'saleMonth', description: 'Month(s) when tax sales occur (e.g., May, October)', volatility: 'annual' },
    { section: 'taxSale', fieldKey: 'onlineAvailable', description: 'Whether online bidding is available (true or false)', volatility: 'annual' },
    { section: 'taxSale', fieldKey: 'registrationRequired', description: 'Whether bidder registration is required (true or false)', volatility: 'annual' },
    { section: 'taxSale', fieldKey: 'registrationFee', description: 'Registration fee in USD as a number', volatility: 'annual' },
    { section: 'taxSale', fieldKey: 'depositRequired', description: 'Deposit amount or percentage required to bid', volatility: 'annual' },
    { section: 'taxSale', fieldKey: 'interestRate', description: 'Annual interest rate for tax liens as a percentage number (e.g., 18 for 18%)', volatility: 'static' },
    { section: 'taxSale', fieldKey: 'penaltyRate', description: 'Penalty rate or premium as a percentage number', volatility: 'static' },
    { section: 'taxSale', fieldKey: 'redemptionPeriodDays', description: 'Redemption period in days as a number', volatility: 'static' },
    { section: 'taxSale', fieldKey: 'paymentDeadlineDays', description: 'Days after winning bid that full payment is due', volatility: 'annual' },
    { section: 'taxSale', fieldKey: 'paymentMethods', description: 'Accepted payment methods (e.g., cashiers check, wire transfer, credit card)', volatility: 'annual' },
    { section: 'taxSale', fieldKey: 'auctionPlatform', description: 'Name of online auction platform if any (e.g., GovEase, RealAuction, Bid4Assets)', volatility: 'annual' },
  ],
  assessor: [
    { section: 'physical', fieldKey: 'assessorPortalUrl', description: 'URL to the online property search or parcel viewer', volatility: 'static' },
    { section: 'physical', fieldKey: 'appealDeadline', description: 'Deadline for appealing assessed value (e.g., "September 1st" or "30 days after notice")', volatility: 'annual' },
    { section: 'physical', fieldKey: 'assessmentCycle', description: 'How often properties are reassessed (e.g., annually, every 3 years)', volatility: 'static' },
    { section: 'physical', fieldKey: 'homesteadExemption', description: 'Homestead exemption amount in USD or description', volatility: 'annual' },
  ],
  recorder: [
    { section: 'recording', fieldKey: 'deedRecordingFee', description: 'Fee to record a deed in USD as a number', volatility: 'annual' },
    { section: 'recording', fieldKey: 'transferTaxRate', description: 'Transfer or documentary stamp tax rate (e.g., "$0.70 per $100" or "0.7%")', volatility: 'annual' },
    { section: 'recording', fieldKey: 'electronicFilingAvailable', description: 'Whether e-recording is available (true or false)', volatility: 'annual' },
    { section: 'recording', fieldKey: 'turnaroundDays', description: 'Typical days to record a document as a number', volatility: 'quarterly' },
    { section: 'recording', fieldKey: 'recorderPortalUrl', description: 'URL to the online recording portal or document search', volatility: 'static' },
  ],
  gis: [
    { section: 'physical', fieldKey: 'gisPortalUrl', description: 'URL to the GIS or parcel viewer', volatility: 'static' },
    { section: 'physical', fieldKey: 'parcelDataDownloadAvailable', description: 'Whether parcel data is downloadable (true or false)', volatility: 'annual' },
    { section: 'zoning', fieldKey: 'zoningMapUrl', description: 'URL to the zoning map or viewer', volatility: 'static' },
  ],
  planning_zoning: [
    { section: 'zoning', fieldKey: 'shortTermRentalAllowed', description: 'Whether short-term rentals (Airbnb/VRBO) are allowed in residential zones (true, false, or "conditional")', volatility: 'annual' },
    { section: 'zoning', fieldKey: 'shortTermRentalPermitRequired', description: 'Whether a permit is required for short-term rentals (true or false)', volatility: 'annual' },
    { section: 'zoning', fieldKey: 'minimumLotSizeSqft', description: 'Minimum lot size in residential zones in square feet as a number', volatility: 'static' },
    { section: 'zoning', fieldKey: 'zoningPortalUrl', description: 'URL to the zoning portal or ordinance database', volatility: 'static' },
    { section: 'permits', fieldKey: 'permitApplicationUrl', description: 'URL to apply for building permits online', volatility: 'annual' },
    { section: 'permits', fieldKey: 'permitTurnaroundDays', description: 'Typical permit approval turnaround in days as a number', volatility: 'quarterly' },
  ],
  building: [
    { section: 'permits', fieldKey: 'buildingPermitRequired', description: 'Whether building permits are required for renovations (true or false)', volatility: 'static' },
    { section: 'permits', fieldKey: 'permitApplicationUrl', description: 'URL to apply for permits online', volatility: 'annual' },
    { section: 'permits', fieldKey: 'permitTurnaroundDays', description: 'Typical permit approval turnaround in days as a number', volatility: 'quarterly' },
    { section: 'permits', fieldKey: 'contractorLicenseRequired', description: 'Whether contractor license is required (true or false)', volatility: 'static' },
    { section: 'permits', fieldKey: 'buildingDeptPhone', description: 'Building department phone number as a string', volatility: 'quarterly' },
  ],
}

export const AUTO_PUBLISH_CONFIDENCE = 0.85
export const SONNET_FALLBACK_CONFIDENCE = 0.6
export const HAIKU_MODEL = 'claude-haiku-4-5-20251001'
export const SONNET_MODEL = 'claude-sonnet-4-6'

export function buildExtractionPrompt(
  officeType: string,
  county: string,
  state: string,
  content: string,
): string {
  const fields = OFFICE_TYPE_FIELDS[officeType] ?? []
  const fieldList = fields
    .map(f => `- ${f.section}.${f.fieldKey}: ${f.description} [volatility: ${f.volatility}]`)
    .join('\n')

  return `You are extracting jurisdiction information for ${county} County, ${state} from an official government website.

Office type: ${officeType.replace(/_/g, ' ')}

Website content (cleaned markdown):
<content>
${content.slice(0, 12000)}
</content>

Extract the following fields. Only include fields where you found clear evidence in the text above.

Fields to extract:
${fieldList}

Return a JSON array. For each field found, include:
{
  "section": "sectionName",
  "fieldKey": "fieldName",
  "value": <extracted value — string, number, or boolean>,
  "confidence": <0.0 to 1.0>,
  "sourceSnippet": "<exact quote from the text — max 200 chars>",
  "volatility": "<static|annual|per_sale|quarterly>",
  "notes": "<optional: clarification or caveat, omit if none>"
}

Confidence scale:
- 1.0: explicit, unambiguous statement
- 0.8–0.9: clearly stated, minor interpretation needed
- 0.6–0.7: implied or inferred from context
- Below 0.6: omit the field entirely

Return only the JSON array, no other text. If no fields are found, return [].`
}

export function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

export function parseExtractionResponse(text: string): ExtractionResult[] {
  const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []
  return parsed.filter(
    (item): item is ExtractionResult =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as ExtractionResult).section === 'string' &&
      typeof (item as ExtractionResult).fieldKey === 'string' &&
      (item as ExtractionResult).value !== undefined &&
      typeof (item as ExtractionResult).confidence === 'number' &&
      (item as ExtractionResult).confidence >= SONNET_FALLBACK_CONFIDENCE,
  )
}

let _platformAnthropic: Anthropic | null = null
export function getPlatformAnthropic(env: RuntimeEnvironment = process.env): Anthropic {
  assertSideEffectAllowed('ai', env)
  if (!_platformAnthropic) {
    const apiKey = env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured')
    _platformAnthropic = new Anthropic({ apiKey })
  }
  return _platformAnthropic
}
