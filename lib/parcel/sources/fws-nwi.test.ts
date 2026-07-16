import { describe, expect, it, vi } from 'vitest'
import { FWS_NWI_SOURCE_URL, fetchNwiWetlands } from './fws-nwi'

const response = (payload: unknown, ok = true) => ({ ok, json: async () => payload }) as Response

describe('FWS National Wetlands Inventory source', () => {
  it('reports a mapped feature as preliminary wetland evidence', async () => {
    const result = await fetchNwiWetlands(28.9685, -81.3165, vi.fn().mockResolvedValue(response({ features: [{ attributes: { ATTRIBUTE: 'PFO1A' } }] })))
    expect(result).toEqual({ wetlandsPresent: true, wetlandsNwiStatus: 'MAPPED_FEATURE' })
  })

  it('does not treat an empty map response as a no-wetlands conclusion', async () => {
    const result = await fetchNwiWetlands(28.9685, -81.3165, vi.fn().mockResolvedValue(response({ features: [] })))
    expect(result).toEqual({ wetlandsNwiStatus: 'NO_MAPPED_FEATURE' })
  })

  it('fails closed for service errors and requests only the official NWI layer', async () => {
    await expect(fetchNwiWetlands(28.9685, -81.3165, vi.fn().mockResolvedValue(response({ error: { message: 'bad request' } })))).rejects.toThrow('FWS_NWI_QUERY_FAILED')
    expect(FWS_NWI_SOURCE_URL).toContain('/Wetlands/MapServer/0')
  })
})
