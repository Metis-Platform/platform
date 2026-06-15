import { describe, expect, it } from 'vitest'
import { parseZoningFeatures } from './ingest'

describe('parseZoningFeatures', () => {
  it('extracts polygon zoning code and name from GeoJSON features', () => {
    const polygons = parseZoningFeatures({
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: { ZONE: 'R-1', NAME: 'Single Family Residential' },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [-81, 29],
            [-81, 29.1],
            [-80.9, 29.1],
            [-81, 29],
          ]],
        },
      }],
    }, { fipsField: 'ZONE', nameField: 'NAME' })

    expect(polygons).toHaveLength(1)
    expect(polygons[0]).toMatchObject({
      zoneCode: 'R-1',
      zoneName: 'Single Family Residential',
    })
  })
})
