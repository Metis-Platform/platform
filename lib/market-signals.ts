import { db } from '@/lib/db'
import type { ProfileField, ProfileSectionRecord } from '@/lib/jurisdiction-profile'

type CountyKey = string

type JurisdictionTarget = {
  id: string
  state: string
  county: string
  fips: string | null
}

type CensusCountySignal = {
  population?: number
  priorPopulation?: number
  populationGrowthRatePct?: number
  unemploymentRatePct?: number
}

type HudCountySignal = {
  fmrStudio?: number
  fmrOneBedroom?: number
  fmrTwoBedroom?: number
  fmrThreeBedroom?: number
  fmrFourBedroom?: number
}

type SocrataCountySignal = {
  taxDelinquencyRatePct?: number
}

type AttomCountySignal = {
  foreclosureFilingRatePer1K?: number
  fixFlipRatePct?: number
  institutionalInvestorSharePct?: number
  investorPurchaseSharePct?: number
  medianPropertyValue?: number
  avgCapRatePct?: number
}

type MarketSignalInput = CensusCountySignal & HudCountySignal & SocrataCountySignal & AttomCountySignal

type OpenDataDelinquencySource = {
  url: string
  state: string
  county?: string
  countyField?: string
  delinquentCountField?: string
  parcelCountField?: string
  rateField?: string
}

export type MarketSignalSyncResult = {
  censusYear: number | null
  hudYear: number
  updated: number
  fmrRatesUpserted: number
  attomEnabled: boolean
}

const CENSUS_SOURCE_URL = 'https://api.census.gov/data'
const HUD_FMR_SOURCE_URL = 'https://www.huduser.gov/hudapi/public/fmr/listCounties'

function countyKey(state: string, county: string): CountyKey {
  return `${state}:${county.toLowerCase().replace(/\s+county$/i, '').trim()}`
}

function stateCountyKey(stateFips: string, countyFips: string): CountyKey {
  return `${stateFips}${countyFips}`
}

function field<T extends string | number | boolean | string[]>(
  value: T,
  sourceUrl: string,
  verifiedAt: string,
  volatility: ProfileField['volatility'] = 'annual',
): ProfileField<T> {
  return {
    value,
    sourceUrl,
    verifiedAt,
    confidence: 0.85,
    volatility,
  }
}

function pct(numerator: number, denominator: number): number | undefined {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return undefined
  return Math.round((numerator / denominator) * 10000) / 100
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function normalize(value: number | undefined, max: number): number | undefined {
  if (value === undefined || !Number.isFinite(value)) return undefined
  return clamp(value / max, 0, 1)
}

function weightedScore(parts: [number | undefined, number][]): number | undefined {
  let totalWeight = 0
  let total = 0

  for (const [value, weight] of parts) {
    if (value === undefined) continue
    total += value * weight
    totalWeight += weight
  }

  if (totalWeight === 0) return undefined
  return Math.round((total / totalWeight) * 100)
}

export function computeOpportunityScore(signals: MarketSignalInput): number | undefined {
  return weightedScore([
    [normalize(signals.foreclosureFilingRatePer1K, 10), 0.25],
    [normalize(signals.taxDelinquencyRatePct, 20), 0.2],
    [normalize(Math.max(signals.populationGrowthRatePct ?? 0, 0), 10), 0.2],
    [signals.unemploymentRatePct === undefined ? undefined : clamp(1 - signals.unemploymentRatePct / 20, 0, 1), 0.15],
    [normalize(signals.avgCapRatePct, 12), 0.2],
  ])
}

export function computeSaturationScore(signals: MarketSignalInput): number | undefined {
  return weightedScore([
    [normalize(signals.institutionalInvestorSharePct, 40), 0.35],
    [normalize(signals.fixFlipRatePct, 15), 0.35],
    [normalize(signals.investorPurchaseSharePct, 40), 0.3],
  ])
}

async function fetchCensusYear(year: number): Promise<Map<CountyKey, CensusCountySignal>> {
  const fields = 'NAME,B01003_001E,B23025_003E,B23025_005E'
  const currentUrl = `${CENSUS_SOURCE_URL}/${year}/acs/acs5?get=${fields}&for=county:*&in=state:*`
  const priorUrl = `${CENSUS_SOURCE_URL}/${year - 1}/acs/acs5?get=NAME,B01003_001E&for=county:*&in=state:*`

  const [currentRes, priorRes] = await Promise.all([fetch(currentUrl), fetch(priorUrl)])
  if (!currentRes.ok || !priorRes.ok) {
    throw new Error(`Census ACS ${year} unavailable`)
  }

  const currentRows = await currentRes.json() as string[][]
  const priorRows = await priorRes.json() as string[][]
  const priorByFips = new Map<CountyKey, number>()

  for (const row of priorRows.slice(1)) {
    const population = Number(row[1])
    const state = row[2]
    const county = row[3]
    if (Number.isFinite(population)) priorByFips.set(stateCountyKey(state, county), population)
  }

  const result = new Map<CountyKey, CensusCountySignal>()
  for (const row of currentRows.slice(1)) {
    const population = Number(row[1])
    const laborForce = Number(row[2])
    const unemployed = Number(row[3])
    const state = row[4]
    const county = row[5]
    const fipsKey = stateCountyKey(state, county)
    const priorPopulation = priorByFips.get(fipsKey)
    const populationGrowthRatePct = priorPopulation ? pct(population - priorPopulation, priorPopulation) : undefined

    result.set(fipsKey, {
      population: Number.isFinite(population) ? population : undefined,
      priorPopulation,
      populationGrowthRatePct,
      unemploymentRatePct: pct(unemployed, laborForce),
    })
  }

  return result
}

async function fetchLatestCensusSignals(now: Date): Promise<{ year: number | null; signals: Map<CountyKey, CensusCountySignal> }> {
  const currentYear = now.getUTCFullYear()
  for (let year = currentYear - 1; year >= currentYear - 5; year--) {
    try {
      return { year, signals: await fetchCensusYear(year) }
    } catch {
      continue
    }
  }
  return { year: null, signals: new Map() }
}

async function fetchHudSignals(year: number): Promise<Map<CountyKey, HudCountySignal>> {
  const result = new Map<CountyKey, HudCountySignal>()
  const res = await fetch(`${HUD_FMR_SOURCE_URL}/${year}`)
  if (!res.ok) return result

  const payload = await res.json() as unknown
  const rows = Array.isArray(payload)
    ? payload
    : typeof payload === 'object' && payload !== null && 'data' in payload && Array.isArray(payload.data)
      ? payload.data
      : []

  for (const row of rows as Record<string, unknown>[]) {
    const state = String(row.state_alpha ?? row.state ?? row.stusps ?? '').toUpperCase()
    const county = String(row.county_name ?? row.county ?? row.name ?? '')
    if (!state || !county) continue

    const signal: HudCountySignal = {}
    const rentKeys: [keyof HudCountySignal, string[]][] = [
      ['fmrStudio', ['fmr0', 'efficiency', 'studio']],
      ['fmrOneBedroom', ['fmr1', 'one_bedroom', 'bedroom1']],
      ['fmrTwoBedroom', ['fmr2', 'two_bedroom', 'bedroom2']],
      ['fmrThreeBedroom', ['fmr3', 'three_bedroom', 'bedroom3']],
      ['fmrFourBedroom', ['fmr4', 'four_bedroom', 'bedroom4']],
    ]

    for (const [target, keys] of rentKeys) {
      const value = keys.map((key) => Number(row[key])).find((n) => Number.isFinite(n) && n > 0)
      if (value) signal[target] = value
    }

    if (Object.keys(signal).length > 0) result.set(countyKey(state, county), signal)
  }

  return result
}

async function fetchSocrataSignals(): Promise<Map<CountyKey, SocrataCountySignal>> {
  const result = new Map<CountyKey, SocrataCountySignal>()
  const configured = process.env.MARKET_SIGNALS_DELINQUENCY_SOURCES
  if (!configured) return result

  let sources: OpenDataDelinquencySource[]
  try {
    sources = JSON.parse(configured) as OpenDataDelinquencySource[]
  } catch {
    console.warn('[sync-market-signals] Invalid MARKET_SIGNALS_DELINQUENCY_SOURCES JSON')
    return result
  }

  for (const source of sources) {
    if (!source.url || !source.state) continue

    const res = await fetch(source.url)
    if (!res.ok) continue

    const payload = await res.json() as unknown
    const rows = Array.isArray(payload)
      ? payload
      : typeof payload === 'object' && payload !== null && 'result' in payload
        ? Array.isArray((payload.result as { records?: unknown }).records) ? (payload.result as { records: unknown[] }).records : []
        : []

    for (const row of rows as Record<string, unknown>[]) {
      const county = source.county ?? (source.countyField ? String(row[source.countyField] ?? '') : '')
      if (!county) continue

      const directRate = source.rateField ? Number(row[source.rateField]) : undefined
      const delinquentCount = source.delinquentCountField ? Number(row[source.delinquentCountField]) : undefined
      const parcelCount = source.parcelCountField ? Number(row[source.parcelCountField]) : undefined
      const taxDelinquencyRatePct = Number.isFinite(directRate)
        ? directRate
        : delinquentCount !== undefined && parcelCount !== undefined
          ? pct(delinquentCount, parcelCount)
          : undefined

      if (taxDelinquencyRatePct === undefined) continue
      result.set(countyKey(source.state, county), { taxDelinquencyRatePct })
    }
  }

  return result
}

async function fetchAttomSignals(): Promise<Map<CountyKey, AttomCountySignal>> {
  if (!process.env.ATTOM_API_KEY) return new Map()
  return new Map()
}

function mergeSignals(...sources: (MarketSignalInput | undefined)[]): MarketSignalInput {
  return Object.assign({}, ...sources.filter(Boolean))
}

function marketSignalsSection(signals: MarketSignalInput, verifiedAt: string, censusYear: number | null, hudYear: number): ProfileSectionRecord {
  const section: ProfileSectionRecord = {}
  const censusSource = censusYear ? `${CENSUS_SOURCE_URL}/${censusYear}/acs/acs5` : CENSUS_SOURCE_URL
  const hudSource = `${HUD_FMR_SOURCE_URL}/${hudYear}`
  const attomSource = 'https://api.gateway.attomdata.com/propertyapi/v1.0.0'

  for (const [key, value] of Object.entries(signals)) {
    if (value === undefined) continue
    const sourceUrl = key.startsWith('fmr')
      ? hudSource
      : ['foreclosureFilingRatePer1K', 'fixFlipRatePct', 'institutionalInvestorSharePct', 'investorPurchaseSharePct', 'medianPropertyValue', 'avgCapRatePct'].includes(key)
        ? attomSource
        : censusSource
    section[key] = field(value, sourceUrl, verifiedAt, key === 'taxDelinquencyRatePct' ? 'quarterly' : 'annual')
  }

  const opportunityScore = computeOpportunityScore(signals)
  if (opportunityScore !== undefined) section.opportunityScore = field(opportunityScore, 'computed:market-signals', verifiedAt, 'quarterly')

  const saturationScore = computeSaturationScore(signals)
  if (saturationScore !== undefined) section.saturationScore = field(saturationScore, 'computed:market-signals', verifiedAt, 'quarterly')

  return section
}

async function upsertFmrRates(jurisdiction: JurisdictionTarget, hud: HudCountySignal | undefined, year: number): Promise<number> {
  if (!hud) return 0

  const rents: [number, number | undefined][] = [
    [0, hud.fmrStudio],
    [1, hud.fmrOneBedroom],
    [2, hud.fmrTwoBedroom],
    [3, hud.fmrThreeBedroom],
    [4, hud.fmrFourBedroom],
  ]

  let count = 0
  for (const [bedrooms, amount] of rents) {
    if (!amount) continue
    await db.fmrRate.upsert({
      where: { state_county_year_bedrooms: { state: jurisdiction.state, county: jurisdiction.county, year, bedrooms } },
      update: { amount },
      create: { state: jurisdiction.state, county: jurisdiction.county, year, bedrooms, amount },
    })
    count++
  }
  return count
}

export async function syncMarketSignals(now = new Date()): Promise<MarketSignalSyncResult> {
  const [jurisdictions, census, hudSignals, socrataSignals, attomSignals] = await Promise.all([
    db.jurisdiction.findMany({
      where: { fips: { not: null } },
      select: { id: true, state: true, county: true, fips: true },
    }),
    fetchLatestCensusSignals(now),
    fetchHudSignals(now.getUTCFullYear()),
    fetchSocrataSignals(),
    fetchAttomSignals(),
  ])

  const verifiedAt = now.toISOString()
  let updated = 0
  let fmrRatesUpserted = 0

  for (const jurisdiction of jurisdictions) {
    if (!jurisdiction.fips) continue

    const byFips = jurisdiction.fips
    const byName = countyKey(jurisdiction.state, jurisdiction.county)
    const signals = mergeSignals(
      census.signals.get(byFips),
      hudSignals.get(byName),
      socrataSignals.get(byName),
      attomSignals.get(byName),
    )
    const section = marketSignalsSection(signals, verifiedAt, census.year, now.getUTCFullYear())
    if (Object.keys(section).length === 0) continue

    await db.jurisdictionProfile.upsert({
      where: { jurisdictionId: jurisdiction.id },
      update: { marketSignals: section },
      create: { jurisdictionId: jurisdiction.id, marketSignals: section },
    })

    fmrRatesUpserted += await upsertFmrRates(jurisdiction, hudSignals.get(byName), now.getUTCFullYear())
    updated++
  }

  return {
    censusYear: census.year,
    hudYear: now.getUTCFullYear(),
    updated,
    fmrRatesUpserted,
    attomEnabled: Boolean(process.env.ATTOM_API_KEY),
  }
}
