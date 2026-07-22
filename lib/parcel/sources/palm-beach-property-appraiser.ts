import type { ParcelProfile } from '@/lib/exit-engine/types'
import { numberFromUnknown } from './types'
import { OfficialParcelLocationError } from './volusia-property-appraiser'

export const PALM_BEACH_FIPS = '12099'
const PALM_BEACH_PROPERTY_URL = 'https://pbcpao.gov/Property/Details'

type FetchLike = typeof fetch

type PbcModel = {
  propertyDetail?: Record<string, unknown>
  assessmentInfo?: Array<Record<string, unknown>>
  appraisalInfo?: Array<Record<string, unknown>>
  landDetails?: Array<Record<string, unknown>>
}

export function palmBeachParcelQueryUrl(apn: string): string {
  if (!/^\d{17}$/.test(apn)) throw new OfficialParcelLocationError('PALM_BEACH_PARCEL_IDENTIFIER_INVALID')
  const url = new URL(PALM_BEACH_PROPERTY_URL)
  url.searchParams.set('parcelId', apn)
  return url.toString()
}

export async function fetchOfficialPalmBeachParcelFacts(
  input: { apn: string; fipsCounty: string },
  fetchImpl: FetchLike = fetch,
): Promise<Partial<ParcelProfile>> {
  if (input.fipsCounty !== PALM_BEACH_FIPS) return {}

  const sourceUrl = palmBeachParcelQueryUrl(input.apn)
  let response: Response
  try {
    response = await fetchImpl(sourceUrl, { headers: { Accept: 'text/html' } })
  } catch {
    throw new OfficialParcelLocationError('PALM_BEACH_PARCEL_SOURCE_UNAVAILABLE')
  }
  if (!response.ok) throw new OfficialParcelLocationError('PALM_BEACH_PARCEL_SOURCE_UNAVAILABLE')

  let html: string
  try {
    html = await response.text()
  } catch {
    throw new OfficialParcelLocationError('PALM_BEACH_PARCEL_SOURCE_UNAVAILABLE')
  }

  const model = parsePalmBeachPropertyModel(html)
  if (!model) throw new OfficialParcelLocationError('PALM_BEACH_PARCEL_NOT_FOUND')
  return normalizePalmBeachParcelModel(model)
}

export function normalizePalmBeachParcelModel(model: PbcModel): Partial<ParcelProfile> {
  const detail = model.propertyDetail ?? {}
  const land = model.landDetails?.[0] ?? {}
  const assessment = model.assessmentInfo?.[0] ?? {}
  const appraisal = model.appraisalInfo?.[0] ?? {}
  const lotSizeAcres = numberFromUnknown(land.Acres) ?? numberFromUnknown(detail.Acres)
  const lotSizeSqFt = numberFromUnknown(land.SqFt)
    ?? (lotSizeAcres == null ? undefined : lotSizeAcres * 43_560)
  const landUseCode = stringValue(detail.UseCodeDesc) ?? stringValue(detail.UseCode)
  const structureSqFt = numberFromUnknown(detail.SqFt)
  const improvementValue = numberFromUnknown(appraisal.ImprovementValue)
  const improved = improvementValue != null
    ? improvementValue > 0
    : structureSqFt != null
      ? structureSqFt > 0
      : isVacantUse(landUseCode)
        ? false
        : undefined

  return {
    lotSizeAcres,
    lotSizeSqFt,
    frontageLinearFt: numberFromUnknown(land.Front),
    lotDepthFt: numberFromUnknown(land.Depth),
    landUseCode,
    improved,
    zoning: stringValue(detail.Zoning) ?? stringValue(land.Zoning),
    zoningDescription: stringValue(detail.ZoningDesc),
    assessedValue: numberFromUnknown(assessment.AssessedValue),
    assessedYear: numberFromUnknown(assessment.TaxYear) ?? numberFromUnknown(detail.TaxYear),
    marketValueEstimate: numberFromUnknown(appraisal.TotalMarketValue),
  }
}

export function parsePalmBeachPropertyModel(html: string): PbcModel | null {
  const match = html.match(/var\s+model\s*=\s*(\{[\s\S]*?\});\s*\$\.ajax\s*\(/)
  if (!match) return null
  try {
    const parsed = JSON.parse(match[1]) as unknown
    return parsed != null && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as PbcModel
      : null
  } catch {
    return null
  }
}

function isVacantUse(value: string | undefined): boolean {
  return value?.toUpperCase().includes('VACANT') ?? false
}

function stringValue(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.trim() === '') return undefined
  return value.trim()
}
