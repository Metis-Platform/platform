import { describe, expect, it } from 'vitest'
import { authorityBoundaryPayload, parseAuthorityBoundaryGeometry } from './AuthorityBoundaryClient'

describe('authority boundary editor parser', () => {
  it('accepts only GeoJSON Polygon or MultiPolygon input', () => {
    expect(parseAuthorityBoundaryGeometry('{"type":"Polygon","coordinates":[]}')).toEqual({ type: 'Polygon', coordinates: [] })
    expect(parseAuthorityBoundaryGeometry('{"type":"Point","coordinates":[0,0]}')).toBeNull()
    expect(parseAuthorityBoundaryGeometry('{bad json')).toBeNull()
  })

  it('includes the current boundary ID only for an append-only replacement', () => {
    const geometry = { type: 'Polygon', coordinates: [] }
    expect(authorityBoundaryPayload('claim-1', geometry)).toEqual({ claimId: 'claim-1', geometry })
    expect(authorityBoundaryPayload('claim-1', geometry, 'boundary-1')).toEqual({
      claimId: 'claim-1', geometry, replacesBoundaryId: 'boundary-1',
    })
  })
})
