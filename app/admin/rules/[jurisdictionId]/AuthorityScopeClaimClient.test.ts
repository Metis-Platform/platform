import { describe, expect, it } from 'vitest'
import { authorityScopePayload } from './AuthorityScopeClaimClient'

describe('authority scope claim editor', () => {
  it('trims the human-reviewed authority statement before publication', () => {
    expect(authorityScopePayload('source-1', 'UNINCORPORATED_COUNTY', '  official authority statement  ')).toEqual({
      sourceUrlId: 'source-1', scope: 'UNINCORPORATED_COUNTY', citation: 'official authority statement',
    })
  })
})
