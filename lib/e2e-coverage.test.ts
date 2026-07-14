import { describe, expect, it } from 'vitest'
import { validateE2eCoverage } from './e2e-coverage'

describe('E2E coverage contract', () => {
  it('requires correlation evidence for mutation stories', () => {
    expect(validateE2eCoverage({ version: 1, stories: [{
      id: 'mutation', risk: 'high', mode: 'mutation', spec: 'e2e/mutation.spec.ts', status: 'blocked', notes: 'Needs QA.',
    }] }).success).toBe(false)
  })

  it('accepts a mutation story with reset and audit evidence', () => {
    expect(validateE2eCoverage({ version: 1, stories: [{
      id: 'mutation', risk: 'high', mode: 'mutation', spec: 'e2e/mutation.spec.ts', status: 'blocked', notes: 'Needs QA.',
      evidence: { fixtureSet: 'integration-v1', responseHeader: 'x-request-id', auditAction: 'MUTATION' },
    }] }).success).toBe(true)
  })
})
