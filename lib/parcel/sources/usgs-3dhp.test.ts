import { describe, expect, it, vi } from 'vitest'
import { fetchUsgsHydrography, USGS_3DHP_SOURCE_URL } from './usgs-3dhp'

const response = (payload: unknown) => new Response(JSON.stringify(payload))

describe('USGS 3D Hydrography source', () => {
  it('returns only mapped feature types from the official flowline and waterbody layers', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
    fetchImpl.mockImplementation(input => Promise.resolve(response({ features: String(input).includes('/60/') ? [{ attributes: {} }] : [] })))

    await expect(fetchUsgsHydrography(28.9685, -81.3165, fetchImpl)).resolves.toEqual({
      hydrography3dhpStatus: 'MAPPED_FEATURE', hydrography3dhpFeatureTypes: ['WATERBODY'],
    })
    expect(fetchImpl).toHaveBeenCalledWith(expect.stringContaining(`${USGS_3DHP_SOURCE_URL}/50/query?`), expect.any(Object))
    expect(fetchImpl).toHaveBeenCalledWith(expect.stringContaining(`${USGS_3DHP_SOURCE_URL}/60/query?`), expect.any(Object))
  })

  it('treats an empty map response as no mapped feature, not a determination', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(response({ features: [] })))

    await expect(fetchUsgsHydrography(28.9685, -81.3165, fetchImpl)).resolves
      .toEqual({ hydrography3dhpStatus: 'NO_MAPPED_FEATURE' })
  })

  it('fails closed for an official service error', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(response({ error: { message: 'bad request' } })))

    await expect(fetchUsgsHydrography(28.9685, -81.3165, fetchImpl)).rejects
      .toThrow('USGS_3DHP_QUERY_FAILED: bad request')
  })
})
