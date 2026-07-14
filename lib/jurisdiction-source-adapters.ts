export type JurisdictionAdapter = {
  id: string
  state: string
  officeTypes: string[]
  authorityOwner: string
  sourceUrl: string
}

export type DiscoveredJurisdictionSource = {
  adapterId: string
  officeType: string
  url: string
  authorityOwner: string
  authorityRationale: string
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
]

export function adaptersForState(state: string) {
  return ADAPTERS.filter(adapter => adapter.state === state.trim().toUpperCase())
}

export function discoverJurisdictionSources(input: {
  state: string
  requestedOfficeTypes: string[]
  now?: Date
}) {
  const adapters = adaptersForState(input.state)
  if (adapters.length === 0) {
    return { status: 'DISCOVERY_NEEDED' as const, sources: [] as DiscoveredJurisdictionSource[] }
  }
  const now = input.now ?? new Date()
  const sources = adapters.flatMap(adapter =>
    input.requestedOfficeTypes
      .filter(officeType => adapter.officeTypes.includes(officeType))
      .map(officeType => ({
        adapterId: adapter.id,
        officeType,
        url: adapter.sourceUrl,
        authorityOwner: adapter.authorityOwner,
        authorityRationale: 'Registry capability is a discovery lead only; authority review is required before extraction or claim publication.',
        discoveredAt: now,
      })),
  )
  return { status: sources.length ? 'DISCOVERED' as const : 'DISCOVERY_NEEDED' as const, sources }
}

export async function persistDiscoveredJurisdictionSources(input: {
  jurisdictionId: string
  sources: DiscoveredJurisdictionSource[]
  createSource: (data: { jurisdictionId: string; officeType: string; url: string }) => Promise<unknown>
}) {
  if (!input.jurisdictionId.trim()) throw new Error('JURISDICTION_REQUIRED')
  for (const source of input.sources) {
    // Create-only is deliberate: adapters may never mutate authority, evidence,
    // or a human-curated source after its identity is registered.
    await input.createSource({ jurisdictionId: input.jurisdictionId, officeType: source.officeType, url: source.url })
  }
}
