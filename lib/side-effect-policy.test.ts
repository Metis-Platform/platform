import { describe, expect, it } from 'vitest'
import {
  assertSideEffectAllowed,
  resolveEmailDeliveryPolicy,
  SideEffectPolicyError,
} from './side-effect-policy'

describe('runtime side-effect policy', () => {
  it('preserves normal behavior in explicit local development', () => {
    expect(() => assertSideEffectAllowed('cron', { APP_ENV: 'local' })).not.toThrow()
    expect(resolveEmailDeliveryPolicy(['investor@example.com'], { APP_ENV: 'local' })).toBe('send')
  })

  it('allows production only when the production boundary identity matches', () => {
    const authorizedProduction = {
      APP_ENV: 'production',
      METIS_ENVIRONMENT_ID: 'metis-production-v1',
      PRODUCTION_AUTHORIZED_ENVIRONMENT_ID: 'metis-production-v1',
    }

    expect(() => assertSideEffectAllowed('cron', authorizedProduction)).not.toThrow()
    expect(resolveEmailDeliveryPolicy(['investor@example.com'], authorizedProduction)).toBe('send')
    expect(() => assertSideEffectAllowed('cron', { APP_ENV: 'production' })).toThrow(
      SideEffectPolicyError
    )
  })

  it.each(['preview', 'integration', 'release-candidate', 'test'])(
    'fails closed in guarded environment %s',
    appEnvironment => {
      const env = { APP_ENV: appEnvironment }
      expect(() => assertSideEffectAllowed('cron', env)).toThrow(SideEffectPolicyError)
      expect(() => assertSideEffectAllowed('auction', env)).toThrow(SideEffectPolicyError)
      expect(() => assertSideEffectAllowed('ai', env)).toThrow(SideEffectPolicyError)
      expect(() => resolveEmailDeliveryPolicy(['investor@example.com'], env)).toThrow(
        SideEffectPolicyError
      )
    }
  )

  it.each([
    ['cron', 'INTEGRATION_CRON_MODE'],
    ['auction', 'INTEGRATION_AUCTION_MODE'],
    ['ai', 'INTEGRATION_AI_MODE'],
  ] as const)('allows only an explicitly enabled %s mode', (sideEffect, variable) => {
    expect(() =>
      assertSideEffectAllowed(sideEffect, { APP_ENV: 'integration', [variable]: 'enabled' })
    ).not.toThrow()
  })

  it('fails closed in hosted execution when APP_ENV is missing or invalid', () => {
    expect(() => assertSideEffectAllowed('cron', { VERCEL: '1' })).toThrow(SideEffectPolicyError)
    expect(() =>
      assertSideEffectAllowed('cron', { VERCEL: '1', APP_ENV: 'local' })
    ).toThrow(SideEffectPolicyError)
    expect(() => assertSideEffectAllowed('cron', { APP_ENV: 'development' })).toThrow()
  })

  it('sinks integration email without requiring an allowlist', () => {
    expect(
      resolveEmailDeliveryPolicy(['investor@example.com'], {
        APP_ENV: 'integration',
        INTEGRATION_EMAIL_MODE: 'sink',
      })
    ).toBe('sink')
  })

  it('allows only exact normalized recipients in allowlist mode', () => {
    const env = {
      APP_ENV: 'integration',
      INTEGRATION_EMAIL_MODE: 'allowlist',
      INTEGRATION_EMAIL_ALLOWLIST: 'test@example.com, owner@example.com',
    }

    expect(resolveEmailDeliveryPolicy([' Test@Example.com '], env)).toBe('send')
    expect(() => resolveEmailDeliveryPolicy(['customer@example.com'], env)).toThrow(
      SideEffectPolicyError
    )
  })
})
