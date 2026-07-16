import { describe, expect, it, vi } from 'vitest'
import { FEMA_NFHL_SOURCE_URL, fetchFloodZone } from './fema-nfhl'

const response = (payload: unknown) => ({ ok: true, json: async () => payload }) as Response

describe('FEMA NFHL parcel flood lookup', () => {
  it('reads the flood zone and panel from their documented layers', async () => {
    const fetchImpl = vi.fn().mockImplementation((url: string) => {
      if (url.startsWith(`${FEMA_NFHL_SOURCE_URL}/28/query?`)) {
        return response({ features: [{ attributes: { FLD_ZONE: 'X' } }] })
      }
      if (url.startsWith(`${FEMA_NFHL_SOURCE_URL}/3/query?`)) {
        return response({ features: [{ attributes: { FIRM_PAN: '12127C0360J' } }] })
      }
      throw new Error(`Unexpected FEMA URL: ${url}`)
    })

    await expect(fetchFloodZone(28.9685, -81.3165, fetchImpl)).resolves.toEqual({
      floodZone: 'X',
      floodPanel: '12127C0360J',
    })
    expect(fetchImpl).toHaveBeenCalledWith(expect.stringContaining('/28/query?'), expect.anything())
    expect(fetchImpl).toHaveBeenCalledWith(expect.stringContaining('outFields=FLD_ZONE'), expect.anything())
    expect(fetchImpl).toHaveBeenCalledWith(expect.stringContaining('/3/query?'), expect.anything())
    expect(fetchImpl).toHaveBeenCalledWith(expect.stringContaining('outFields=FIRM_PAN'), expect.anything())
  })

  it('omits flood facts when neither official layer intersects the point', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response({ features: [] }))

    await expect(fetchFloodZone(0, 0, fetchImpl)).resolves.toEqual({})
  })

  it('fails closed on ArcGIS errors and conflicting flood-zone features', async () => {
    const serviceError = vi.fn().mockResolvedValue(response({
      error: { code: 400, message: 'Failed to execute query.' },
    }))
    await expect(fetchFloodZone(28.9685, -81.3165, serviceError))
      .rejects.toThrow('FEMA_NFHL_QUERY_FAILED')

    const ambiguous = vi.fn().mockImplementation((url: string) => response(url.includes('/28/query?')
      ? { features: [{ attributes: { FLD_ZONE: 'X' } }, { attributes: { FLD_ZONE: 'AE' } }] }
      : { features: [{ attributes: { FIRM_PAN: '12127C0360J' } }] }))
    await expect(fetchFloodZone(28.9685, -81.3165, ambiguous))
      .rejects.toThrow('FEMA_NFHL_AMBIGUOUS_FLD_ZONE')
  })
})
