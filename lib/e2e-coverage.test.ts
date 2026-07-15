import { describe, expect, it } from 'vitest'
import { missingE2eCoverageSpecs, validateE2eCoverage } from './e2e-coverage'

describe('E2E coverage contract', () => {
  it('requires correlation evidence for mutation stories', () => {
    expect(validateE2eCoverage({ version: 1, stories: [{
      id: 'mutation', risk: 'high', mode: 'mutation', spec: 'e2e/mutation.spec.ts', status: 'blocked', notes: 'Needs QA.',
      evidence: { fixtureSet: 'integration-v1', responseHeader: 'x-request-id', auditAction: 'MUTATION' },
    }] }).success).toBe(false)
  })

  it('accepts a mutation story with reset and audit evidence', () => {
    expect(validateE2eCoverage({ version: 1, stories: [{
      id: 'mutation', risk: 'high', mode: 'mutation', spec: 'e2e/mutation.spec.ts', status: 'blocked', notes: 'Needs QA.',
      evidence: { fixtureSet: 'integration-v1', responseHeader: 'x-request-id', auditAction: 'MUTATION' },
      journey: {
        entryPoint: '/dashboard/example',
        actions: [{ userAction: 'Save example', expectedRequest: 'POST /api/example' }],
        persistedOutcome: 'Example record exists for the fixture tenant.',
        cleanup: 'Fixture reset removes the example record.',
      },
    }] }).success).toBe(true)
  })

  it('reports a declared spec that does not exist', () => {
    const coverage = validateE2eCoverage({ version: 1, stories: [{
      id: 'readonly', risk: 'low', mode: 'read-only', spec: 'e2e/missing.spec.ts', status: 'active', notes: 'Read-only.',
    }] })
    expect(coverage.success).toBe(true)
    if (coverage.success) expect(missingE2eCoverageSpecs(coverage.data, () => false)).toEqual(['e2e/missing.spec.ts'])
  })
})
