import { describe, expect, it } from 'vitest'
import { evaluateE2eMutationGuard } from './e2e-guard'

const safe = {
  APP_ENV: 'integration', METIS_ENVIRONMENT_ID: 'qa-1', INTEGRATION_RESET_AUTHORIZED_ENVIRONMENT_ID: 'qa-1',
  DATABASE_URL: 'postgresql://x@qa.neon.tech/db', INTEGRATION_ALLOWED_DATABASE_HOSTS: 'qa.neon.tech', PRODUCTION_DATABASE_HOSTS: 'prod.neon.tech',
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_cWEuY2xlcmsuY29tJA', INTEGRATION_ALLOWED_CLERK_INSTANCE_HOSTS: 'qa.clerk.com', PRODUCTION_CLERK_INSTANCE_HOSTS: 'prod.clerk.com',
  R2_BUCKET_NAME: 'qa-bucket', INTEGRATION_ALLOWED_R2_BUCKET_NAMES: 'qa-bucket', PRODUCTION_R2_BUCKET_NAMES: 'prod-bucket',
  STRIPE_SECRET_KEY: 'sk_test_x', NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_x', INTEGRATION_EMAIL_MODE: 'sink', INTEGRATION_CRON_MODE: 'disabled', INTEGRATION_AUCTION_MODE: 'disabled', INTEGRATION_AI_MODE: 'disabled', E2E_BASE_URL: 'https://qa.example.test',
}

describe('E2E mutation guard', () => {
  it('refuses production and missing URLs before browser launch', () => {
    expect(evaluateE2eMutationGuard({ ...safe, E2E_BASE_URL: 'https://metisplatforms.com' }, 'qa-1').ok).toBe(false)
    expect(evaluateE2eMutationGuard({ ...safe, E2E_BASE_URL: undefined }, 'qa-1').ok).toBe(false)
  })
})
