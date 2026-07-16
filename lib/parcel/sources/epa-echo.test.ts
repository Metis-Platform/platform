import { describe, expect, it, vi } from 'vitest'
import { EPA_ECHO_CWA_SOURCE_URL, fetchEpaFlags } from './epa-echo'

describe('fetchEpaFlags', () => {
  it('returns only accurately named nearby CWA facility evidence', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ Results: { Facilities: [{ FacName: 'Example NPDES Facility' }] } })))
    await expect(fetchEpaFlags(33.4484, -112.074, 1, fetchImpl)).resolves.toEqual({
      epaCwaFacilitySearchStatus: 'FACILITY_FOUND', epaCwaFacilityNames: ['Example NPDES Facility'],
    })
    expect(fetchImpl).toHaveBeenCalledWith(expect.stringContaining(EPA_ECHO_CWA_SOURCE_URL), expect.any(Object))
  })

  it('labels an empty CWA response without calling it environmental clearance', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ Results: { Facilities: [] } })))
    await expect(fetchEpaFlags(33.4484, -112.074, 1, fetchImpl)).resolves.toEqual({ epaCwaFacilitySearchStatus: 'NO_FACILITY_RETURNED' })
  })

  it('keeps malformed provider responses as data gaps', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'unavailable' })))
    await expect(fetchEpaFlags(33.4484, -112.074, 1, fetchImpl)).rejects.toThrow('EPA_ECHO_CWA_QUERY_FAILED')
  })
})
