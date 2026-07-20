import { describe, expect, it } from 'vitest'
import { isAuthorityBoundarySchemaPending } from './jurisdiction-authority-boundary'

describe('authority-boundary rollout guard', () => {
  it('fails closed only while the new boundary table is absent', () => {
    expect(isAuthorityBoundarySchemaPending(new Error(
      'relation "jurisdiction_authority_boundaries" does not exist',
    ))).toBe(true)
    expect(isAuthorityBoundarySchemaPending(new Error('database connection refused'))).toBe(false)
  })
})
