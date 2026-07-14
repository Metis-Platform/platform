import { describe, expect, it } from 'vitest'
import {
  buildResearchProfile,
  retainActiveClaimBackedResearchFields,
  retainClaimBackedResearchFields,
} from './jurisdiction-research'

const field = {
  value: 'tax deed',
  verifiedAt: '2026-07-13T00:00:00.000Z',
  confidence: 0.9,
  volatility: 'annual' as const,
}

describe('investor jurisdiction research projection', () => {
  it('quarantines legacy fields without a claim identifier', () => {
    const profile = buildResearchProfile({ taxSale: { saleType: field } })

    expect(retainClaimBackedResearchFields(profile).taxSale).toEqual({})
  })

  it('keeps a field only when its projected claim is active for that exact field', () => {
    const profile = buildResearchProfile({
      taxSale: {
        saleType: { ...field, claimId: 'claim-current' },
        bidFormat: { ...field, claimId: 'claim-missing' },
      },
    })

    const retained = retainActiveClaimBackedResearchFields(profile, [{
      id: 'claim-current',
      section: 'taxSale',
      fieldKey: 'saleType',
    }])

    expect(retained.taxSale).toEqual({
      saleType: { ...field, claimId: 'claim-current' },
    })
  })

  it('rejects a claim identifier projected onto the wrong field', () => {
    const profile = buildResearchProfile({
      taxSale: { saleType: { ...field, claimId: 'claim-current' } },
    })

    const retained = retainActiveClaimBackedResearchFields(profile, [{
      id: 'claim-current',
      section: 'taxSale',
      fieldKey: 'bidFormat',
    }])

    expect(retained.taxSale).toEqual({})
  })
})
