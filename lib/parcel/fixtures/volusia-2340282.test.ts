import { describe, expect, it } from 'vitest'
import { evaluateExits } from '@/lib/exit-engine/engine'
import {
  VOLUSIA_2340282_CONTEXT,
  VOLUSIA_2340282_EVIDENCE,
  VOLUSIA_2340282_PARCEL,
} from './volusia-2340282'

describe('Volusia canonical parcel 2340282', () => {
  it('retains the official-source references for the documented facts', () => {
    expect(VOLUSIA_2340282_EVIDENCE.propertyAppraiser).toContain('altkey=2340282')
    expect(VOLUSIA_2340282_PARCEL).toMatchObject({
      apn: '2340282', lotSizeSqFt: 5_000, frontageLinearFt: 50, lotDepthFt: 100, zoning: 'R-4', improved: false,
    })
  })

  it('keeps residential build exits conditional pending the nonconforming-lot determination', () => {
    const exits = evaluateExits(VOLUSIA_2340282_CONTEXT)
    const builder = exits.find(exit => exit.exitKey === 'VACANT_SELL_TO_BUILDER')
    const build = exits.find(exit => exit.exitKey === 'VACANT_BUILD_AND_SELL')

    expect(builder?.verdict).toBe('CONDITIONAL')
    expect(build?.verdict).toBe('CONDITIONAL')
    expect(builder?.blockers).toEqual(expect.arrayContaining([
      'Lot is smaller than jurisdiction minimum lot size',
      'Lot frontage is smaller than jurisdiction minimum width',
    ]))
    expect(builder?.conditions.join(' ')).toContain('nonconforming-lot eligibility')
    expect(builder?.verdict).not.toBe('NOT_VIABLE')
  })
})
