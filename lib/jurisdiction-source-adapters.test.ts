import { describe, expect, it } from 'vitest'
import { discoverJurisdictionSources, queueDiscoveredJurisdictionSources } from './jurisdiction-source-adapters'

describe('jurisdiction source adapters', () => {
  it('fails closed for unsupported states', () => {
    expect(discoverJurisdictionSources({ state: 'TX', requestedOfficeTypes: ['assessor'] })).toEqual({
      status: 'DISCOVERY_NEEDED', sources: [],
    })
  })

  it('returns discovery leads with explicit non-authority rationale', () => {
    const result = discoverJurisdictionSources({ state: 'FL', requestedOfficeTypes: ['assessor'], now: new Date('2026-07-14T00:00:00Z') })
    expect(result.status).toBe('DISCOVERED')
    expect(result.sources[0]).toMatchObject({ officeType: 'assessor', adapterId: 'fl-county-offices-v1' })
    expect(result.sources[0].authorityRationale).toContain('authority review')
  })

  it('prefers exact county official candidates over a statewide discovery link', () => {
    const result = discoverJurisdictionSources({
      state: 'FL', county: 'Volusia County', requestedOfficeTypes: ['assessor', 'gis', 'building'], now: new Date('2026-07-14T00:00:00Z'),
    })
    expect(result.sources).toEqual([
      expect.objectContaining({ adapterId: 'fl-volusia-county-offices-v1', officeType: 'assessor', url: 'https://paproapp.vcgov.org/' }),
      expect.objectContaining({ adapterId: 'fl-volusia-county-offices-v1', officeType: 'gis', url: 'https://www.volusia.org/services/financial-and-administrative-services/finance-department/information-technology/geographic-information-services/' }),
      expect.objectContaining({ adapterId: 'fl-volusia-county-offices-v1', officeType: 'building', url: 'https://www.volusia.org/services/growth-and-resource-management/building-and-zoning/' }),
    ])
    expect(result.sources.some(source => source.url === 'https://www.myfloridacfo.com/')).toBe(false)
  })

  it('queues discovery metadata without creating an authority source record', async () => {
    const created: unknown[] = []
    const sources = discoverJurisdictionSources({ state: 'FL', requestedOfficeTypes: ['assessor'], now: new Date('2026-07-14T00:00:00Z') }).sources
    await queueDiscoveredJurisdictionSources({
      jurisdictionId: 'jurisdiction-1',
      sources,
      createLead: async source => { created.push(source) },
    })
    expect(created).toEqual([{ jurisdictionId: 'jurisdiction-1', ...sources[0] }])
  })
})
