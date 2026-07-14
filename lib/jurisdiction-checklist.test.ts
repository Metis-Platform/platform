import { describe, expect, it } from 'vitest'
import {
  buildJurisdictionChecklistTemplate,
  hasJurisdictionChecklistTemplate,
  renderJurisdictionChecklistTitle,
} from './jurisdiction-checklist'

describe('jurisdiction checklist interpolation', () => {
  it('interpolates verified profile values with citation labels', () => {
    const result = renderJurisdictionChecklistTitle(
      'Confirm redemption period: {{taxSale.redemptionPeriodMonths}} months',
      {
        taxSale: {
          redemptionPeriodMonths: {
            value: 24,
            claimId: 'claim-redemption-period',
            verifiedAt: '2026-06-15T00:00:00.000Z',
            confidence: 0.95,
            volatility: 'static',
            citation: { label: 'State statute', url: 'https://example.test/statute' },
          },
        },
      },
      'redemption period',
      'tax collector',
    )

    expect(result).toEqual({
      text: 'Confirm redemption period: 24 [State statute] months',
      missing: false,
    })
  })

  it('reads nested contact properties', () => {
    const result = renderJurisdictionChecklistTitle(
      'Pull permits - office: {{contacts.buildingPermits.website}}',
      {
        contacts: {
          buildingPermits: {
            value: { name: 'Building Division', website: 'https://example.test/permits' },
            claimId: 'claim-building-permits',
            verifiedAt: '2026-06-15T00:00:00.000Z',
            confidence: 0.9,
            volatility: 'annual',
          },
        },
      },
      'building permit office',
      'building permits',
    )

    expect(result).toEqual({
      text: 'Pull permits - office: https://example.test/permits',
      missing: false,
    })
  })

  it('turns missing profile values into verification tasks', () => {
    const result = renderJurisdictionChecklistTitle(
      'Budget transfer tax: {{recording.transferTaxRate}}',
      null,
      'transfer tax rate',
      'recorder',
    )

    expect(result).toEqual({
      text: 'Verify transfer tax rate with recorder',
      missing: true,
    })
  })

  it('turns legacy values without claim provenance into verification tasks', () => {
    const result = renderJurisdictionChecklistTitle(
      'Confirm redemption period: {{taxSale.redemptionPeriodMonths}} months',
      {
        taxSale: {
          redemptionPeriodMonths: {
            value: 24,
            verifiedAt: '2026-06-15T00:00:00.000Z',
            confidence: 1,
            volatility: 'static',
          },
        },
      },
      'redemption period',
      'tax collector',
    )

    expect(result).toEqual({
      text: 'Verify redemption period with tax collector',
      missing: true,
    })
  })

  it('builds sparse-profile checklists for every strategy', () => {
    const strategies = ['TAX_LIEN', 'TAX_DEED', 'FORECLOSURE', 'LAND', 'WHOLESALE', 'FIX_FLIP', 'BUY_HOLD', 'MULTIFAMILY'] as const

    for (const strategy of strategies) {
      expect(hasJurisdictionChecklistTemplate(strategy)).toBe(true)
      const template = buildJurisdictionChecklistTemplate(strategy, null)
      expect(template?.items.length).toBeGreaterThanOrEqual(6)
      expect(template?.items.every((item) => item.title.startsWith('Verify '))).toBe(true)
    }
  })
})
