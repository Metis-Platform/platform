import { describe, expect, it } from 'vitest'
import { featureVerificationInventoryGaps, validateFeatureVerificationInventory, discoverServerActionTargets } from './feature-verification-inventory'

const covered = {
  version: 1,
  scope: 'app-api-mutations',
  entries: [{ target: 'app/api/example/route.ts', status: 'covered', storyId: 'example' }],
} as const

describe('feature verification mutation inventory', () => {
  it('requires catalog linkage or an issue-linked classification', () => {
    expect(validateFeatureVerificationInventory({ ...covered, entries: [{ target: 'app/api/example/route.ts', status: 'deferred' }] }).success).toBe(false)
  })

  it('reports unclassified routes, stale entries, bad stories, and missing specs', () => {
    const inventory = validateFeatureVerificationInventory(covered)
    expect(inventory.success).toBe(true)
    if (!inventory.success) return

    expect(featureVerificationInventoryGaps(
      inventory.data,
      ['app/api/example/route.ts', 'app/api/missing/route.ts'],
      new Set(['other']),
      () => false,
      new Map([['example', 'e2e/example.spec.ts']]),
    )).toEqual({
      missingTargets: ['app/api/missing/route.ts'],
      unknownTargets: [],
      invalidStoryIds: ['app/api/example/route.ts'],
      missingSpecs: ['app/api/example/route.ts'],
    })
  })

  it('discovers each exported server action rather than only its module', () => {
    expect(discoverServerActionTargets('lib/actions')).toEqual(expect.arrayContaining([
      'lib/actions/contact.ts#createContact',
      'lib/actions/contact.ts#deleteContact',
      'lib/actions/lien.ts#createLien',
      'lib/actions/lien.ts#updateLien',
    ]))
    expect(discoverServerActionTargets('lib/actions')).not.toContain('lib/actions/contact.ts')
  })
})
