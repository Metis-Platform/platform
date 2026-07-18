import { describe, expect, it, vi } from 'vitest'
import { fetchUsgsElevation, USGS_3DEP_EPQS_SOURCE_URL } from './usgs-3dep'

describe('USGS 3DEP elevation point source', () => {
  it('returns only the interpolated point elevation from the official EPQS endpoint', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ value: 46.93526445796516, resolution: 1 })))

    await expect(fetchUsgsElevation(28.9685, -81.3165, fetchImpl)).resolves.toEqual({ elevationFeet: 46.93526445796516 })
    expect(fetchImpl).toHaveBeenCalledWith(expect.stringContaining(USGS_3DEP_EPQS_SOURCE_URL), expect.any(Object))
  })

  it('fails closed when EPQS has no numeric interpolated elevation', async () => {
    await expect(fetchUsgsElevation(28.9685, -81.3165, vi.fn().mockResolvedValue(new Response(JSON.stringify({ value: null }))))).rejects
      .toThrow('USGS_3DEP_QUERY_FAILED: Missing interpolated elevation value')
  })
})
