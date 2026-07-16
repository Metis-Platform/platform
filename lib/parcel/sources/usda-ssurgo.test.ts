import { describe, expect, it, vi } from 'vitest'
import { USDA_SSURGO_SOURCE_URL, fetchSsurgoMapUnit } from './usda-ssurgo'

describe('fetchSsurgoMapUnit', () => {
  it('returns the official point map-unit identity', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      Table: [['mukey', 'map_unit_name'], ['627422', 'Gila loam, 0 to 2 percent slopes']],
    })))

    await expect(fetchSsurgoMapUnit(33.4484, -112.074, fetchImpl)).resolves.toEqual({
      soilMapUnitKey: '627422', soilMapUnitName: 'Gila loam, 0 to 2 percent slopes',
    })
    expect(fetchImpl).toHaveBeenCalledWith(USDA_SSURGO_SOURCE_URL, expect.objectContaining({ method: 'POST' }))
  })

  it('returns no fact when the official point lookup has no map unit', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ Table: [['mukey', 'map_unit_name']] })))
    await expect(fetchSsurgoMapUnit(33.4484, -112.074, fetchImpl)).resolves.toBeUndefined()
  })

  it('preserves Soil Data Access failures as a data gap', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ Error: { message: 'Query failed' } })))
    await expect(fetchSsurgoMapUnit(33.4484, -112.074, fetchImpl)).rejects.toThrow('USDA_SSURGO_QUERY_FAILED: Query failed')
  })
})
