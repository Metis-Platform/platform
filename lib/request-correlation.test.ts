import { describe, expect, it } from 'vitest'
import { requestIdFromHeaders } from './request-correlation'

describe('request correlation', () => {
  it('accepts only a UUID request ID', () => {
    expect(requestIdFromHeaders(new Headers({ 'x-request-id': 'e1f137c6-19d4-4df0-881d-c72a7d4a7a74' }))).toBe('e1f137c6-19d4-4df0-881d-c72a7d4a7a74')
    expect(requestIdFromHeaders(new Headers({ 'x-request-id': 'client-controlled' }))).toBeUndefined()
  })
})
