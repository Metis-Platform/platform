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
    expect(result.sources[0].candidateScope).toBe('DISCOVERY_ENTRYPOINT')
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
    expect(result.sources.every(source => source.candidateScope === 'COUNTY_OFFICE_CANDIDATE')).toBe(true)
    expect(result.sources.some(source => source.url === 'https://www.myfloridacfo.com/')).toBe(false)
  })

  it('keeps a structurally different state county candidate scoped to unincorporated authority', () => {
    const result = discoverJurisdictionSources({
      state: 'AZ', county: 'Maricopa', requestedOfficeTypes: ['assessor', 'recorder', 'planning_zoning', 'building'], now: new Date('2026-07-14T00:00:00Z'),
    })

    expect(result.sources).toEqual([
      expect.objectContaining({ adapterId: 'az-maricopa-county-offices-v1', officeType: 'assessor', url: 'https://www.mcassessor.maricopa.gov/assessor/' }),
      expect.objectContaining({ adapterId: 'az-maricopa-county-offices-v1', officeType: 'recorder', url: 'https://recorder.maricopa.gov/recording/document-search.html' }),
      expect.objectContaining({ adapterId: 'az-maricopa-county-offices-v1', officeType: 'planning_zoning' }),
      expect.objectContaining({ adapterId: 'az-maricopa-county-offices-v1', officeType: 'building' }),
    ])
    expect(result.sources.every(source => source.candidateScope === 'COUNTY_OFFICE_CANDIDATE')).toBe(true)
    expect(result.sources.every(source => source.authorityRationale.includes('unincorporated Maricopa County'))).toBe(true)
  })

  it('keeps Harris County development discovery conditional on municipal ETJ and no county zoning', () => {
    const result = discoverJurisdictionSources({
      state: 'TX', county: 'Harris County',
      requestedOfficeTypes: ['assessor', 'tax_collector', 'recorder', 'gis', 'planning_zoning', 'building'],
      now: new Date('2026-07-20T00:00:00Z'),
    })

    expect(result.sources).toEqual([
      expect.objectContaining({ adapterId: 'tx-harris-county-offices-v1', officeType: 'assessor', url: 'https://hcad.org/' }),
      expect.objectContaining({ adapterId: 'tx-harris-county-offices-v1', officeType: 'tax_collector', url: 'https://www.hctax.net/Property/Overview' }),
      expect.objectContaining({ adapterId: 'tx-harris-county-offices-v1', officeType: 'recorder', url: 'https://cclerk.hctx.net/applications/websearch/RP.aspx/RP.aspx' }),
      expect.objectContaining({ adapterId: 'tx-harris-county-offices-v1', officeType: 'gis' }),
      expect.objectContaining({ adapterId: 'tx-harris-county-offices-v1', officeType: 'planning_zoning' }),
      expect.objectContaining({ adapterId: 'tx-harris-county-offices-v1', officeType: 'building' }),
    ])
    expect(result.sources.every(source => source.candidateScope === 'COUNTY_OFFICE_CANDIDATE')).toBe(true)
    expect(result.sources.every(source => source.authorityRationale.includes('no zoning regulations'))).toBe(true)
    expect(result.sources.every(source => source.authorityRationale.includes('municipal ETJ rules may still apply'))).toBe(true)
  })

  it('returns exact Clark County candidates while keeping Nevada routing fail-closed elsewhere', () => {
    const result = discoverJurisdictionSources({
      state: 'NV', county: 'Clark County', requestedOfficeTypes: ['assessor', 'recorder', 'gis', 'planning_zoning', 'building'], now: new Date('2026-07-22T00:00:00Z'),
    })

    expect(result.sources).toEqual([
      expect.objectContaining({ adapterId: 'nv-clark-county-offices-v1', officeType: 'assessor', url: 'https://www.clarkcountynv.gov/government/assessor/' }),
      expect.objectContaining({ adapterId: 'nv-clark-county-offices-v1', officeType: 'recorder', url: 'https://www.clarkcountynv.gov/government/elected_officials/county_recorder/' }),
      expect.objectContaining({ adapterId: 'nv-clark-county-offices-v1', officeType: 'gis' }),
      expect.objectContaining({ adapterId: 'nv-clark-county-offices-v1', officeType: 'planning_zoning' }),
      expect.objectContaining({ adapterId: 'nv-clark-county-offices-v1', officeType: 'building' }),
    ])
    expect(result.sources.every(source => source.candidateScope === 'COUNTY_OFFICE_CANDIDATE')).toBe(true)
    expect(result.sources.every(source => source.authorityRationale.includes('unincorporated Clark County'))).toBe(true)
    expect(discoverJurisdictionSources({ state: 'NV', county: 'Washoe', requestedOfficeTypes: ['assessor'] })).toEqual({
      status: 'DISCOVERY_NEEDED', sources: [],
    })
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
