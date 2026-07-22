import { fetchJson, objectRecord } from './types'

export const FEMA_DISASTER_DECLARATIONS_SOURCE_URL = 'https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries'

type Declaration = {
  disasterNumber: number
  declarationDate: string
  incidentType: string
}

export function femaDisasterDeclarationsQueryUrl(fipsCounty: string): string {
  if (!/^\d{5}$/.test(fipsCounty)) throw new Error('FEMA_DISASTER_DECLARATIONS_FIPS_INVALID')

  const url = new URL(FEMA_DISASTER_DECLARATIONS_SOURCE_URL)
  url.searchParams.set('$filter', `fipsStateCode eq '${fipsCounty.slice(0, 2)}' and fipsCountyCode eq '${fipsCounty.slice(2)}'`)
  url.searchParams.set('$orderby', 'declarationDate desc')
  url.searchParams.set('$top', '3')
  return url.toString()
}

export async function fetchFemaDisasterDeclarations(
  fipsCounty: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{
  femaDisasterDeclarationStatus: 'RECENT_DECLARATIONS_FOUND' | 'NO_RECENT_DECLARATIONS_RETURNED'
  femaRecentDisasterDeclarations?: Declaration[]
}> {
  const sourceUrl = femaDisasterDeclarationsQueryUrl(fipsCounty)

  try {
    const record = objectRecord(await fetchJson(sourceUrl, undefined, fetchImpl))
    const declarations = Array.isArray(record.DisasterDeclarationsSummaries)
      ? record.DisasterDeclarationsSummaries.map(parseDeclaration).filter((item): item is Declaration => item != null)
      : null
    if (declarations == null) throw new Error('Missing declaration collection')
    return declarations.length > 0
      ? { femaDisasterDeclarationStatus: 'RECENT_DECLARATIONS_FOUND', femaRecentDisasterDeclarations: declarations }
      : { femaDisasterDeclarationStatus: 'NO_RECENT_DECLARATIONS_RETURNED' }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown OpenFEMA error'
    throw new Error(`FEMA_DISASTER_DECLARATIONS_QUERY_FAILED: ${message}`)
  }
}

function parseDeclaration(value: unknown): Declaration | null {
  const record = objectRecord(value)
  const disasterNumber = record.disasterNumber
  const declarationDate = record.declarationDate
  const incidentType = record.incidentType
  if (typeof disasterNumber !== 'number' || !Number.isFinite(disasterNumber)
    || typeof declarationDate !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(declarationDate)
    || typeof incidentType !== 'string' || incidentType.trim() === '') return null
  return { disasterNumber, declarationDate, incidentType: incidentType.trim() }
}
