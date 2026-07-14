import { describe, expect, it } from 'vitest'
import { discoverJurisdictionSources, persistDiscoveredJurisdictionSources } from './jurisdiction-source-adapters'

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

  it('persists only source identity through a create-only boundary', async () => {
    const created: unknown[] = []
    await persistDiscoveredJurisdictionSources({
      jurisdictionId: 'jurisdiction-1',
      sources: discoverJurisdictionSources({ state: 'FL', requestedOfficeTypes: ['assessor'] }).sources,
      createSource: async source => { created.push(source) },
    })
    expect(created).toEqual([{ jurisdictionId: 'jurisdiction-1', officeType: 'assessor', url: 'https://www.myfloridacfo.com/' }])
  })
})
