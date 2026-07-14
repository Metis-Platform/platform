import { describe, expect, it } from 'vitest'
import { evaluateE2eReadOnlyGuard } from './e2e-readonly-guard'

describe('E2E read-only guard', () => {
  it('allows an explicit non-production target', () => {
    expect(evaluateE2eReadOnlyGuard({ E2E_BASE_URL: 'https://qa.example.test' })).toEqual({ ok: true, errors: [] })
  })

  it('refuses missing, malformed, and production targets', () => {
    expect(evaluateE2eReadOnlyGuard({}).ok).toBe(false)
    expect(evaluateE2eReadOnlyGuard({ E2E_BASE_URL: 'not-a-url' }).ok).toBe(false)
    expect(evaluateE2eReadOnlyGuard({ E2E_BASE_URL: 'https://metisplatforms.com' }).ok).toBe(false)
  })
})
