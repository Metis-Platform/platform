import { describe, expect, it, vi } from 'vitest'
import { fetchPadusFederalFeeManagers, USGS_PADUS_FEDERAL_FEE_SOURCE_URL } from './usgs-padus'

const response = (payload: unknown) => new Response(JSON.stringify(payload))

describe('USGS PAD-US federal fee manager source', () => {
  it('returns only exact mapped federal manager names', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(response({ features: [
      { attributes: { Mang_Name: 'Bureau of Land Management' } },
      { attributes: { Mang_Name: 'Bureau of Land Management' } },
    ] })))

    await expect(fetchPadusFederalFeeManagers(34.1, -117.2, fetchImpl)).resolves.toEqual({
      padusFederalFeeStatus: 'MAPPED_FEATURE', padusFederalFeeManagerNames: ['Bureau of Land Management'],
    })
    expect(fetchImpl).toHaveBeenCalledWith(expect.stringContaining(`${USGS_PADUS_FEDERAL_FEE_SOURCE_URL}/query?`), expect.any(Object))
  })

  it('treats an empty map response as no mapped feature, not an ownership or restrictions determination', async () => {
    await expect(fetchPadusFederalFeeManagers(34.1, -117.2, vi.fn(() => Promise.resolve(response({ features: [] })))))
      .resolves.toEqual({ padusFederalFeeStatus: 'NO_MAPPED_FEATURE' })
  })

  it('fails closed for a service error', async () => {
    await expect(fetchPadusFederalFeeManagers(34.1, -117.2, vi.fn(() => Promise.resolve(response({ error: { message: 'bad request' } })))))
      .rejects.toThrow('USGS_PADUS_QUERY_FAILED: bad request')
  })
})
