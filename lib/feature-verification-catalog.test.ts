import { describe, expect, it } from 'vitest'
import { featureVerificationCatalog, summarizeFeatureVerificationCatalog } from './feature-verification-catalog'

describe('feature verification catalog', () => {
  it('bundles the same valid tracked stories that CI enforces', () => {
    const catalog = featureVerificationCatalog()

    expect(catalog.version).toBe(1)
    expect(catalog.stories).toHaveLength(28)
    expect(catalog.stories.find(story => story.id === 'investor-create-save-delete-deal')).toMatchObject({
      mode: 'mutation',
      evidence: { responseHeader: 'x-request-id', auditAction: 'DEAL_CREATED' },
      journey: { entryPoint: '/dashboard/deals/new?strategy=TAX_LIEN' },
    })
  })

  it('reports honest execution and QA-blocking totals', () => {
    expect(summarizeFeatureVerificationCatalog()).toEqual({
      total: 28,
      active: 1,
      mutation: 26,
      blocked: 27,
      critical: 12,
    })
  })
})
