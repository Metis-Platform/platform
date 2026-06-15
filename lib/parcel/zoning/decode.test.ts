import { describe, expect, it } from 'vitest'

describe('zoning decode contract', () => {
  it('documents decoded zoning shape', () => {
    const decoded = {
      zoneCode: 'R-1',
      description: 'Single-family residential',
      minLotSizeSqFt: 7500,
      setbacks: { front: 25, side: 7.5, rear: 20 },
      allowedUses: ['single_family'],
      strAllowed: false,
    }

    expect(decoded.zoneCode).toBe('R-1')
    expect(decoded.setbacks.front).toBe(25)
  })
})
