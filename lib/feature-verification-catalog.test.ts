import { describe, expect, it } from 'vitest'
import { featureVerificationCatalog, summarizeFeatureVerificationCatalog } from './feature-verification-catalog'

describe('feature verification catalog', () => {
  it('bundles the same valid tracked stories that CI enforces', () => {
    const catalog = featureVerificationCatalog()

    expect(catalog.version).toBe(1)
    expect(catalog.stories).toHaveLength(36)
    expect(catalog.stories.find(story => story.id === 'investor-create-save-delete-deal')).toMatchObject({
      mode: 'mutation',
      evidence: { responseHeader: 'x-request-id', auditAction: 'DEAL_CREATED' },
      journey: { entryPoint: '/dashboard/deals/new?strategy=TAX_LIEN' },
    })
  })

  it('reports honest execution and QA-blocking totals', () => {
    expect(summarizeFeatureVerificationCatalog()).toEqual({
      total: 36,
      active: 1,
      mutation: 34,
      blocked: 35,
      critical: 19,
    })
  })
})
