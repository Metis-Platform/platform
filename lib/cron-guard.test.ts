import { describe, expect, it } from 'vitest'
import { guardCronRequest } from './cron-guard'

const request = (authorization?: string) =>
  new Request('https://example.test/api/cron/test', {
    headers: authorization ? { authorization } : undefined,
  })

describe('guardCronRequest', () => {
  it('fails closed when CRON_SECRET is unset', async () => {
    const response = guardCronRequest(request('Bearer undefined'), {
      env: { APP_ENV: 'local' },
    })

    expect(response?.status).toBe(401)
    await expect(response?.json()).resolves.toEqual({ error: 'Unauthorized' })
  })

  it('rejects an invalid secret', () => {
    const response = guardCronRequest(request('Bearer wrong'), {
      env: { APP_ENV: 'local', CRON_SECRET: 'correct' },
    })

    expect(response?.status).toBe(401)
  })

  it('returns an inspectable skip before work in reset-safe integration mode', async () => {
    const response = guardCronRequest(request('Bearer secret'), {
      env: {
        APP_ENV: 'integration',
        CRON_SECRET: 'secret',
        INTEGRATION_CRON_MODE: 'disabled',
      },
    })

    expect(response?.status).toBe(200)
    await expect(response?.json()).resolves.toEqual({
      skipped: true,
      reason: 'disabled_by_environment_policy',
    })
  })

  it('allows an authenticated explicitly enabled integration cron', () => {
    const response = guardCronRequest(request('Bearer secret'), {
      env: {
        APP_ENV: 'integration',
        CRON_SECRET: 'secret',
        INTEGRATION_CRON_MODE: 'enabled',
      },
    })

    expect(response).toBeNull()
  })

  it('blocks an auction cron before feed work when auction mode is disabled', () => {
    const response = guardCronRequest(request('Bearer secret'), {
      env: {
        APP_ENV: 'integration',
        CRON_SECRET: 'secret',
        INTEGRATION_CRON_MODE: 'enabled',
        INTEGRATION_AUCTION_MODE: 'disabled',
      },
      requiredSideEffects: ['auction'],
    })

    expect(response?.status).toBe(200)
  })
})
