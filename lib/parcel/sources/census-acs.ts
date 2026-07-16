import { fetchJson, numberFromUnknown } from './types'

export const CENSUS_ACS_2024_SOURCE_URL = 'https://api.census.gov/data/2024/acs/acs5'

export async function fetchDemographics(
  fipsCounty: string,
  tractCode?: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{
  medianHouseholdIncome?: number
  renterOccupancyPct?: number
  vacancyRatePct?: number
  populationDensity?: number
}> {
  const state = fipsCounty.slice(0, 2)
  const county = fipsCounty.slice(2)
  const tract = tractCode ?? '*'
  const params = new URLSearchParams({
    get: 'B19013_001E,B25003_003E,B25003_001E,B25002_003E,B25002_001E',
    for: `tract:${tract}`,
    in: `state:${state} county:${county}`,
  })
  const json = await fetchJson(`${CENSUS_ACS_2024_SOURCE_URL}?${params.toString()}`, undefined, fetchImpl)
  if (!Array.isArray(json) || json.length < 2 || !Array.isArray(json[1])) return {}
  const row = json[1] as unknown[]
  const renterOccupied = numberFromUnknown(row[1])
  const totalTenure = numberFromUnknown(row[2])
  const vacant = numberFromUnknown(row[3])
  const totalOccupancy = numberFromUnknown(row[4])

  return {
    medianHouseholdIncome: numberFromUnknown(row[0]),
    renterOccupancyPct: totalTenure ? renterOccupied == null ? undefined : renterOccupied / totalTenure : undefined,
    vacancyRatePct: totalOccupancy ? vacant == null ? undefined : vacant / totalOccupancy : undefined,
  }
}
