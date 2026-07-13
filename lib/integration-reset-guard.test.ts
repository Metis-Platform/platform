import { describe, expect, it } from 'vitest'
import { evaluateIntegrationResetPreflight } from './integration-reset-guard'

const clerkPublishableKey = (host: string) =>
  `pk_live_${Buffer.from(`${host}$`).toString('base64url')}`

const SAFE_ENV = {
  APP_ENV: 'integration',
  METIS_ENVIRONMENT_ID: 'metis-shared-integration',
  INTEGRATION_RESET_AUTHORIZED_ENVIRONMENT_ID: 'metis-shared-integration',
  DATABASE_URL: 'postgresql://user:password@ep-integration.neon.tech/metis',
  INTEGRATION_ALLOWED_DATABASE_HOSTS: 'ep-integration.neon.tech',
  PRODUCTION_DATABASE_HOSTS: 'ep-production.neon.tech',
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: clerkPublishableKey('clerk-integration.example'),
  INTEGRATION_ALLOWED_CLERK_INSTANCE_HOSTS: 'clerk-integration.example',
  PRODUCTION_CLERK_INSTANCE_HOSTS: 'clerk-production.example',
  R2_BUCKET_NAME: 'metis-integration',
  INTEGRATION_ALLOWED_R2_BUCKET_NAMES: 'metis-integration',
  PRODUCTION_R2_BUCKET_NAMES: 'metis-production',
  STRIPE_SECRET_KEY: 'sk_test_example',
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_example',
  INTEGRATION_EMAIL_MODE: 'sink',
  INTEGRATION_CRON_MODE: 'disabled',
  INTEGRATION_AUCTION_MODE: 'disabled',
  INTEGRATION_AI_MODE: 'disabled',
} satisfies Record<string, string>

const CONFIRMATION = 'metis-shared-integration'

describe('integration reset preflight', () => {
  it('passes a fully allowlisted integration configuration', () => {
    expect(evaluateIntegrationResetPreflight(SAFE_ENV, CONFIRMATION)).toEqual({
      ok: true,
      errors: [],
    })
  })

  it.each(['local', 'preview', 'release-candidate', 'production', 'test', 'invalid'])(
    'rejects APP_ENV=%s',
    appEnvironment => {
      const result = evaluateIntegrationResetPreflight(
        { ...SAFE_ENV, APP_ENV: appEnvironment },
        CONFIRMATION
      )

      expect(result.ok).toBe(false)
      expect(result.errors).toContain('APP_ENV must be exactly "integration".')
    }
  )

  it('requires an explicit matching operator confirmation', () => {
    const missing = evaluateIntegrationResetPreflight(SAFE_ENV, undefined)
    const wrong = evaluateIntegrationResetPreflight(SAFE_ENV, 'production')

    expect(missing.errors).toContain(
      'The operator must explicitly confirm the integration environment ID.'
    )
    expect(wrong.errors).toContain(
      'Environment identity, reset authorization, and operator confirmation must match.'
    )
  })

  it.each([
    ['Database host', 'DATABASE_URL', 'postgresql://user:password@ep-unknown.neon.tech/metis'],
    ['Clerk instance', 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', clerkPublishableKey('clerk-unknown.example')],
    ['R2 bucket', 'R2_BUCKET_NAME', 'r2-unknown'],
  ])('rejects an unknown %s identity', (label, variable, identity) => {
    const result = evaluateIntegrationResetPreflight(
      { ...SAFE_ENV, [variable]: identity },
      CONFIRMATION
    )

    expect(result.errors).toContain(`${label} identity is not in the integration allowlist.`)
  })

  it.each([
    [
      'Database host',
      {
        DATABASE_URL: 'postgresql://user:password@ep-production.neon.tech/metis',
        INTEGRATION_ALLOWED_DATABASE_HOSTS: 'ep-production.neon.tech',
      },
    ],
    [
      'Clerk instance',
      {
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: clerkPublishableKey('clerk-production.example'),
        INTEGRATION_ALLOWED_CLERK_INSTANCE_HOSTS: 'clerk-production.example',
      },
    ],
    [
      'R2 bucket',
      { R2_BUCKET_NAME: 'metis-production', INTEGRATION_ALLOWED_R2_BUCKET_NAMES: 'metis-production' },
    ],
  ])('rejects a denylisted production %s', (label, overrides) => {
    const result = evaluateIntegrationResetPreflight(
      { ...SAFE_ENV, ...overrides },
      CONFIRMATION
    )

    expect(result.errors).toContain(`${label} identity is denylisted as production.`)
  })

  it('rejects live Stripe keys', () => {
    const result = evaluateIntegrationResetPreflight(
      {
        ...SAFE_ENV,
        STRIPE_SECRET_KEY: 'sk_live_example',
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_live_example',
      },
      CONFIRMATION
    )

    expect(result.errors).toContain('Stripe must use a test-mode secret key.')
    expect(result.errors).toContain('Stripe must use a test-mode publishable key.')
  })

  it('rejects live email or enabled background side effects', () => {
    const result = evaluateIntegrationResetPreflight(
      {
        ...SAFE_ENV,
        INTEGRATION_EMAIL_MODE: 'live',
        INTEGRATION_CRON_MODE: 'enabled',
        INTEGRATION_AUCTION_MODE: 'enabled',
        INTEGRATION_AI_MODE: 'enabled',
      },
      CONFIRMATION
    )

    expect(result.errors).toEqual(
      expect.arrayContaining([
        'INTEGRATION_EMAIL_MODE must be "sink" or "allowlist".',
        'Cron side effects must be disabled.',
        'Auction feed side effects must be disabled.',
        'AI side effects must be disabled.',
      ])
    )
  })
})
