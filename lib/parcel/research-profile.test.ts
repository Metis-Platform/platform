import { describe, expect, it } from 'vitest'
import { assembleResearchProfile } from './research-profile'

describe('assembleResearchProfile manual fallback', () => {
  it('retains the supplied evidence URL on manually entered parcel facts', () => {
    const profile = assembleResearchProfile('2340282', '12127', 'FL', 'Volusia', [], {
      lotSizeSqFt: 5_000,
      zoning: 'R-4',
    }, 'https://vcpa.vcgov.org/parcel/summary/?altkey=2340282')

    expect(profile.sources.lotSizeSqFt).toMatchObject({
      provider: 'manual',
      sourceUrl: 'https://vcpa.vcgov.org/parcel/summary/?altkey=2340282',
    })
    expect(profile.sources.zoning).toMatchObject({ provider: 'manual' })
  })

  it('retains official source metadata on cached national baseline facts', () => {
    const retrievedAt = new Date('2026-07-16T12:00:00.000Z')
    const profile = assembleResearchProfile('2340282', '12127', 'FL', 'Volusia', [{
      id: 'cache-1',
      tenantId: 'tenant-1',
      apnNormalized: '2340282',
      fipsCounty: '12127',
      source: 'fema_nfhl',
      field: 'floodZone',
      valueJson: 'X',
      normalized: 'X',
      retrievedAt,
      ttlHours: 8_760,
      expiresAt: new Date('2027-07-16T12:00:00.000Z'),
      metadata: {
        source: 'fema_nfhl',
        sourceUrl: 'https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer',
      },
    }])

    expect(profile).toMatchObject({
      floodZone: 'X',
      sources: {
        floodZone: {
          provider: 'fema_nfhl',
          retrievedAt,
          sourceUrl: 'https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer',
        },
      },
    })
  })

  it('retains source-disclosed SSURGO map-unit evidence without deriving a suitability fact', () => {
    const retrievedAt = new Date('2026-07-16T12:00:00.000Z')
    const profile = assembleResearchProfile('13275012', '04013', 'AZ', 'Maricopa', [{
      id: 'cache-soil', tenantId: 'tenant-1', apnNormalized: '13275012', fipsCounty: '04013',
      source: 'usda_ssurgo', field: 'soilMapUnitName', valueJson: 'Gila loam', normalized: 'Gila loam',
      retrievedAt, ttlHours: 8_760, expiresAt: new Date('2027-07-16T12:00:00.000Z'),
      metadata: { source: 'usda_ssurgo', sourceUrl: 'https://SDMDataAccess.sc.egov.usda.gov/Tabular/post.rest' },
    }])

    expect(profile).toMatchObject({
      soilMapUnitName: 'Gila loam',
      sources: {
        soilMapUnitName: {
          provider: 'usda_ssurgo', retrievedAt,
          sourceUrl: 'https://SDMDataAccess.sc.egov.usda.gov/Tabular/post.rest',
        },
      },
    })
    expect(profile).not.toHaveProperty('soilSuitability')
  })

  it('retains USGS interpolated elevation without deriving a terrain conclusion', () => {
    const retrievedAt = new Date('2026-07-16T12:00:00.000Z')
    const profile = assembleResearchProfile('13275012', '04013', 'AZ', 'Maricopa', [{
      id: 'cache-elevation', tenantId: 'tenant-1', apnNormalized: '13275012', fipsCounty: '04013',
      source: 'usgs_3dep', field: 'elevationFeet', valueJson: 1_086.5, normalized: 1_086.5,
      retrievedAt, ttlHours: 8_760, expiresAt: new Date('2027-07-16T12:00:00.000Z'),
      metadata: { source: 'usgs_3dep', sourceUrl: 'https://epqs.nationalmap.gov/v1/json' },
    }])

    expect(profile).toMatchObject({
      elevationFeet: 1_086.5,
      sources: { elevationFeet: { provider: 'usgs_3dep', sourceUrl: 'https://epqs.nationalmap.gov/v1/json' } },
    })
    expect(profile).not.toHaveProperty('slopePercent')
    expect(profile).not.toHaveProperty('buildable')
  })

  it('retains accurately named CWA facility evidence and ignores legacy unsupported EPA flags', () => {
    const retrievedAt = new Date('2026-07-16T12:00:00.000Z')
    const common = {
      tenantId: 'tenant-1', apnNormalized: '13275012', fipsCounty: '04013', source: 'epa_echo',
      retrievedAt, ttlHours: 2_160, expiresAt: new Date('2026-10-14T12:00:00.000Z'),
      metadata: { source: 'epa_echo', sourceUrl: 'https://echodata.epa.gov/echo/cwa_rest_services.get_facilities' },
      createdAt: retrievedAt, updatedAt: retrievedAt,
    }
    const profile = assembleResearchProfile('13275012', '04013', 'AZ', 'Maricopa', [
      { ...common, id: 'epa-status', field: 'epaCwaFacilitySearchStatus', valueJson: 'FACILITY_FOUND', normalized: 'FACILITY_FOUND' },
      { ...common, id: 'epa-name', field: 'epaCwaFacilityNames', valueJson: ['Example NPDES Facility'], normalized: ['Example NPDES Facility'] },
      { ...common, id: 'epa-legacy', field: 'brownfieldFlag', valueJson: false, normalized: false },
    ])

    expect(profile).toMatchObject({
      epaCwaFacilitySearchStatus: 'FACILITY_FOUND', epaCwaFacilityNames: ['Example NPDES Facility'],
      sources: { epaCwaFacilitySearchStatus: { provider: 'epa_echo', sourceUrl: 'https://echodata.epa.gov/echo/cwa_rest_services.get_facilities' } },
    })
    expect(profile.brownfieldFlag).toBeUndefined()
  })
})
