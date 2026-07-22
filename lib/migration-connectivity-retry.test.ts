import { describe, expect, it } from 'vitest'
import { isTransientMigrationConnectivityFailure } from './migration-connectivity-retry'

describe('migration connectivity retry classifier', () => {
  it.each([
    'Error: P1001: Can\'t reach database server at example.neon.tech:5432',
    'connect ETIMEDOUT 203.0.113.1:5432',
    'read ECONNRESET',
  ])('retries transient connectivity output: %s', output => {
    expect(isTransientMigrationConnectivityFailure(output)).toBe(true)
  })

  it.each([
    'Error: P3009 migrate found failed migrations',
    'permission denied for schema public',
    'syntax error at or near "CREATE"',
  ])('does not retry a migration failure: %s', output => {
    expect(isTransientMigrationConnectivityFailure(output)).toBe(false)
  })
})
