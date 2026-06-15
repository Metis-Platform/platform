import { describe, expect, it } from 'vitest'
import { normalizeRegridProperties } from './sources/regrid'
import { normalizeFlDorAttributes } from './sources/fl-dor'

describe('parcel source normalization', () => {
  it('normalizes FL DOR parcel attributes', () => {
    expect(normalizeFlDorAttributes({
      ACRES: '0.5',
      ASSESSED_VALUE: '125000',
      TAX_YEAR: '2025',
      LAND_USE_CODE: '0001',
      IMPROVED: 'no',
    })).toMatchObject({
      lotSizeAcres: 0.5,
      lotSizeSqFt: 21780,
      assessedValue: 125000,
      assessedYear: 2025,
      landUseCode: '0001',
      improved: false,
    })
  })

  it('normalizes Regrid parcel properties', () => {
    expect(normalizeRegridProperties({
      parcelnumb: '12-34-56',
      ll_gisacre: 1,
      parval: 90000,
      taxyear: '2024',
      usedesc: 'VACANT RES',
      bldg_area: '0',
    })).toMatchObject({
      apnRaw: '12-34-56',
      lotSizeAcres: 1,
      lotSizeSqFt: 43560,
      assessedValue: 90000,
      assessedYear: 2024,
      landUseCode: 'VACANT RES',
      improved: false,
      structureSqFt: 0,
      marketValueEstimate: 90000,
    })
  })
})
