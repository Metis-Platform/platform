import { describe, expect, it, vi } from 'vitest'
import { fetchElectricUtility, HIFLD_ELECTRIC_RETAIL_TERRITORIES_SOURCE_URL } from './hifld-electric'

describe('HIFLD electric retail territories', () => {
  it('returns overlapping territory names without claiming electric availability', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ features: [
      { attributes: { NAME: 'Duke Energy Florida', TYPE: 'INVESTOR OWNED' } },
      { attributes: { NAME: 'Florida Power & Light', TYPE: 'INVESTOR OWNED' } },
    ] })))

    await expect(fetchElectricUtility(29.0283, -81.0491, fetchImpl)).resolves.toEqual({
      hifldElectricTerritoryStatus: 'MAPPED_TERRITORY',
      hifldElectricUtilityNames: ['Duke Energy Florida', 'Florida Power & Light'],
      hifldElectricServiceTypes: ['INVESTOR OWNED'],
    })
    expect(String(fetchImpl.mock.calls[0][0])).toContain(HIFLD_ELECTRIC_RETAIL_TERRITORIES_SOURCE_URL)
  })

  it('keeps an empty map response separate from service availability', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ features: [] })))
    await expect(fetchElectricUtility(29.0283, -81.0491, fetchImpl)).resolves.toEqual({ hifldElectricTerritoryStatus: 'NO_MAPPED_TERRITORY_RETURNED' })
  })

  it('fails closed when the provider response is malformed', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'unavailable' })))
    await expect(fetchElectricUtility(29.0283, -81.0491, fetchImpl)).rejects.toThrow('HIFLD_ELECTRIC_TERRITORY_QUERY_FAILED')
  })
})
