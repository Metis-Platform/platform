import coverage from '@/e2e/coverage.json'
import { validateE2eCoverage } from './e2e-coverage'

export function featureVerificationCatalog() {
  const parsed = validateE2eCoverage(coverage)
  if (!parsed.success) throw new Error('FEATURE_VERIFICATION_CATALOG_INVALID')
  return parsed.data
}

export function summarizeFeatureVerificationCatalog() {
  const stories = featureVerificationCatalog().stories
  return {
    total: stories.length,
    active: stories.filter(story => story.status === 'active').length,
    mutation: stories.filter(story => story.mode === 'mutation').length,
    blocked: stories.filter(story => story.status.startsWith('blocked')).length,
    critical: stories.filter(story => story.risk === 'critical').length,
  }
}
