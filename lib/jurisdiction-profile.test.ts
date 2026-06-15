import { describe, expect, it } from 'vitest'
import {
  JURISDICTION_PROFILE_SECTIONS,
  applyProfileFieldUpdate,
  publishProfileSection,
  type JurisdictionProfileSection,
  type ProfileField,
} from './jurisdiction-profile'

describe('jurisdiction profile helpers', () => {
  it('declares the section inventory required by #131-P1', () => {
    expect(JURISDICTION_PROFILE_SECTIONS).toEqual([
      'taxSale',
      'foreclosure',
      'recording',
      'zoning',
      'physical',
      'permits',
      'landlordTenant',
      'section8',
      'wholesale',
      'marketSignals',
      'contacts',
    ])
  })

  it('applies a ProfileField update to one section without mutating existing data', () => {
    const existing = {
      taxSale: {
        saleType: {
          value: 'tax lien',
          verifiedAt: '2026-01-01T00:00:00.000Z',
          confidence: 0.9,
          volatility: 'static',
        } satisfies ProfileField,
      },
    }

    const field = {
      value: 12,
      sourceUrl: 'https://example.test/statute',
      citation: 'FL §197.472',
      verifiedAt: '2026-06-15T00:00:00.000Z',
      confidence: 0.95,
      verifiedById: 'system',
      volatility: 'annual',
    } satisfies ProfileField<number>

    const next = applyProfileFieldUpdate(existing, {
      section: 'taxSale',
      fieldKey: 'redemptionPeriodMonths',
      field,
    })

    expect(next.taxSale.redemptionPeriodMonths).toEqual(field)
    expect(next.taxSale.saleType).toEqual(existing.taxSale.saleType)
    expect(existing.taxSale).not.toHaveProperty('redemptionPeriodMonths')
  })

  it('rejects unknown sections at runtime', () => {
    expect(() =>
      applyProfileFieldUpdate({}, {
        section: 'badSection' as JurisdictionProfileSection,
        fieldKey: 'anything',
        field: {
          value: true,
          verifiedAt: '2026-06-15T00:00:00.000Z',
          confidence: 1,
          volatility: 'static',
        },
      })
    ).toThrow('Invalid jurisdiction profile section')
  })

  it('publishes a section idempotently', () => {
    expect(publishProfileSection(['taxSale'], 'taxSale')).toEqual(['taxSale'])
    expect(publishProfileSection(['taxSale'], 'zoning')).toEqual(['taxSale', 'zoning'])
  })
})
