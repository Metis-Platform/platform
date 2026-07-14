export type JurisdictionAdapter = {
  id: string
  state: string
  county?: string
  officeTypes: string[]
  authorityOwner: string
  sourceUrl?: string
  sourceUrls?: Partial<Record<string, string>>
}

export type DiscoveredJurisdictionSource = {
  adapterId: string
  officeType: string
  url: string
  authorityOwner: string
  authorityRationale: string
  candidateScope: 'DISCOVERY_ENTRYPOINT' | 'COUNTY_OFFICE_CANDIDATE'
  discoveredAt: Date
}

// Code-managed capability registry. An entry permits discovery only; it never
// asserts source authority, publishes claims, or substitutes for human review.
const ADAPTERS: JurisdictionAdapter[] = [
  {
    id: 'fl-county-offices-v1',
    state: 'FL',
    officeTypes: ['assessor', 'tax_collector', 'recorder', 'gis', 'planning_zoning', 'building'],
    authorityOwner: 'Florida county government',
    sourceUrl: 'https://www.myfloridacfo.com/',
  },
  {
    id: 'fl-volusia-county-offices-v1',
    state: 'FL',
    county: 'Volusia',
    officeTypes: ['assessor', 'tax_collector', 'recorder', 'gis', 'planning_zoning', 'building'],
    authorityOwner: 'Volusia County constitutional offices and government',
    sourceUrls: {
      assessor: 'https://paproapp.vcgov.org/',
      tax_collector: 'https://volusiatax.gov/',
      recorder: 'https://www.clerk.org/Search-Records.aspx',
      gis: 'https://www.volusia.org/services/financial-and-administrative-services/finance-department/information-technology/geographic-information-services/',
      planning_zoning: 'https://www.volusia.org/services/growth-and-resource-management/planning-and-development/',
      building: 'https://www.volusia.org/services/growth-and-resource-management/building-and-zoning/',
    },
  },
]

export function adaptersForState(state: string) {
  return ADAPTERS.filter(adapter => adapter.state === state.trim().toUpperCase())
}

function normalizeCounty(county: string) {
  return county.trim().replace(/\s+county$/i, '').toLowerCase()
}

export function adaptersForJurisdiction(state: string, county?: string) {
  const adapters = adaptersForState(state)
  if (!county?.trim()) return adapters.filter(adapter => !adapter.county)
  const exactCountyAdapters = adapters.filter(adapter => adapter.county && normalizeCounty(adapter.county) === normalizeCounty(county))
  return exactCountyAdapters.length > 0 ? exactCountyAdapters : adapters.filter(adapter => !adapter.county)
}

export function discoverJurisdictionSources(input: {
  state: string
  county?: string
  requestedOfficeTypes: string[]
  now?: Date
}) {
  const adapters = adaptersForJurisdiction(input.state, input.county)
  if (adapters.length === 0) {
    return { status: 'DISCOVERY_NEEDED' as const, sources: [] as DiscoveredJurisdictionSource[] }
  }
  const now = input.now ?? new Date()
  const sources: DiscoveredJurisdictionSource[] = adapters.flatMap(adapter =>
    input.requestedOfficeTypes
      .filter(officeType => adapter.officeTypes.includes(officeType) && (adapter.sourceUrls?.[officeType] ?? adapter.sourceUrl))
      .map(officeType => ({
        adapterId: adapter.id,
        officeType,
        url: adapter.sourceUrls?.[officeType] ?? adapter.sourceUrl!,
        authorityOwner: adapter.authorityOwner,
        authorityRationale: 'Registry capability is a discovery lead only; authority review is required before extraction or claim publication.',
        candidateScope: adapter.sourceUrls?.[officeType] ? 'COUNTY_OFFICE_CANDIDATE' : 'DISCOVERY_ENTRYPOINT',
        discoveredAt: now,
      })),
  )
  return { status: sources.length ? 'DISCOVERED' as const : 'DISCOVERY_NEEDED' as const, sources }
}

export async function queueDiscoveredJurisdictionSources(input: {
  jurisdictionId: string
  sources: DiscoveredJurisdictionSource[]
  createLead: (data: {
    jurisdictionId: string
    adapterId: string
    officeType: string
    url: string
    authorityOwner: string
    authorityRationale: string
    candidateScope: 'DISCOVERY_ENTRYPOINT' | 'COUNTY_OFFICE_CANDIDATE'
    discoveredAt: Date
  }) => Promise<unknown>
}) {
  if (!input.jurisdictionId.trim()) throw new Error('JURISDICTION_REQUIRED')
  for (const source of input.sources) {
    // A discovery lead is not a jurisdiction source record. The latter requires
    // explicit review because an adapter may return a statewide directory.
    await input.createLead({ jurisdictionId: input.jurisdictionId, ...source })
  }
}
