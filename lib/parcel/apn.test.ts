import { describe, expect, it } from 'vitest'
import { detectApnFormat, normalizeApn } from './apn'

describe('APN normalization', () => {
  it('normalizes standard Florida parcel IDs', () => {
    expect(normalizeApn('12-345-6789', '12127')).toEqual({
      raw: '12-345-6789',
      normalized: '0123456789',
      format: 'fl_standard',
      fipsCounty: '12127',
    })
  })

  it('normalizes Miami-Dade folios', () => {
    expect(normalizeApn('30-4025-009-0010', '12086').normalized).toBe('3040250090010')
    expect(detectApnFormat('12086')).toBe('miami_folio')
  })

  it('normalizes Lee County STRAP values', () => {
    expect(normalizeApn('12-44-25-04-00001.0000', '12071')).toEqual({
      raw: '12-44-25-04-00001.0000',
      normalized: '1244250400001.0000',
      format: 'lee_strap',
      fipsCounty: '12071',
    })
  })

  it('normalizes Cook County PINs', () => {
    expect(normalizeApn('12-34-567-890-1234', '17031').normalized).toBe('12345678901234')
  })

  it('uses a conservative generic fallback', () => {
    expect(normalizeApn(' ab 12.34 / c ', '06037')).toEqual({
      raw: 'ab 12.34 / c',
      normalized: 'AB1234C',
      format: 'generic',
      fipsCounty: '06037',
    })
  })
})
