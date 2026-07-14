import { describe, expect, it } from 'vitest'
import { INTEGRATION_FIXTURE_MANIFEST } from '../prisma/fixtures/integration-v1'
import {
  executeIntegrationFixtureReset,
  IntegrationResetRefusedError,
  matchesVerifiedPreviousClerkIdentity,
  planIntegrationFixtureReset,
  type IntegrationFixtureInspection,
  type IntegrationFixtureStore,
} from './integration-fixture-reset'

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
  INTEGRATION_FIXTURE_CLERK_ORG_ID: 'org_fixture',
  INTEGRATION_FIXTURE_CLERK_USER_ID: 'user_fixture',
  INTEGRATION_FIXTURE_OWNER_EMAIL: 'fixture@example.test',
} satisfies Record<string, string>

const EMPTY_INSPECTION: IntegrationFixtureInspection = {
  fixtureTenantCount: 0,
  fixtureTenantId: null,
  clerkOrgId: null,
  clerkUserIds: [],
  r2ObjectCount: 0,
  r2ObjectKeys: [],
  stripeArtifactCount: 0,
  stableTenantIdConflict: false,
  databaseRowCounts: { tenants: 0 },
}

class FakeStore implements IntegrationFixtureStore {
  calls: string[] = []
  inspection = EMPTY_INSPECTION
  replaceError = false

  async inspect(): Promise<IntegrationFixtureInspection> {
    this.calls.push('inspect')
    return this.inspection
  }

  async beginResetRun(): Promise<string> {
    this.calls.push('begin')
    return 'reset-run-id'
  }

  async replaceFixture(): Promise<Record<string, number>> {
    this.calls.push('replace')
    if (this.replaceError) throw new Error('synthetic database failure')
    return { tenants: 1, users: 1, deals: 1 }
  }

  async completeResetRun(): Promise<void> {
    this.calls.push('complete')
  }

  async failResetRun(): Promise<void> {
    this.calls.push('fail')
  }
}

describe('integration fixture manifest', () => {
  it('uses stable, versioned identifiers and serializable values', () => {
    const first = JSON.stringify(INTEGRATION_FIXTURE_MANIFEST)
    const second = JSON.stringify(INTEGRATION_FIXTURE_MANIFEST)

    expect(first).toBe(second)
    expect(INTEGRATION_FIXTURE_MANIFEST.fixtureSet).toBe('metis-e2e-v1')
    expect(INTEGRATION_FIXTURE_MANIFEST.tenant.id).toMatch(/^fixture_metis_e2e_v1_/)
    expect(INTEGRATION_FIXTURE_MANIFEST.property.apn).toBe('2340282')
    expect(INTEGRATION_FIXTURE_MANIFEST.jurisdiction.fips).toBe('12127')
  })
})

describe('Clerk rotation verification', () => {
  it('requires the exact previous organization and complete user set', () => {
    expect(matchesVerifiedPreviousClerkIdentity('org-old', ['user-b', 'user-a'], {
      previousOrgId: 'org-old',
      previousUserIds: ['user-a', 'user-b'],
    })).toBe(true)
    expect(matchesVerifiedPreviousClerkIdentity('org-old', ['user-a'], {
      previousOrgId: 'org-other',
      previousUserIds: ['user-a'],
    })).toBe(false)
    expect(matchesVerifiedPreviousClerkIdentity('org-old', ['user-a', 'unexpected'], {
      previousOrgId: 'org-old',
      previousUserIds: ['user-a'],
    })).toBe(false)
  })
})

describe('integration fixture reset orchestration', () => {
  it('refuses unsafe environment state before store access', async () => {
    const store = new FakeStore()

    await expect(
      planIntegrationFixtureReset({
        env: { ...SAFE_ENV, APP_ENV: 'production' },
        confirmation: 'metis-shared-integration',
        store,
      })
    ).rejects.toThrow('Integration reset preflight failed')
    expect(store.calls).toEqual([])
  })

  it('builds a non-mutating plan', async () => {
    const store = new FakeStore()
    const plan = await planIntegrationFixtureReset({
      env: SAFE_ENV,
      confirmation: 'metis-shared-integration',
      store,
    })

    expect(plan).toMatchObject({
      environmentId: 'metis-shared-integration',
      fixtureSet: 'metis-e2e-v1',
      willReplaceFixtureTenant: false,
      blockers: [],
    })
    expect(store.calls).toEqual(['inspect'])
  })

  it('reports external orphan blockers without mutation', async () => {
    const store = new FakeStore()
    store.inspection = {
      ...EMPTY_INSPECTION,
      fixtureTenantCount: 1,
      fixtureTenantId: INTEGRATION_FIXTURE_MANIFEST.tenant.id,
      clerkOrgId: SAFE_ENV.INTEGRATION_FIXTURE_CLERK_ORG_ID,
      clerkUserIds: [SAFE_ENV.INTEGRATION_FIXTURE_CLERK_USER_ID],
      r2ObjectCount: 2,
      stripeArtifactCount: 1,
    }

    const plan = await planIntegrationFixtureReset({
      env: SAFE_ENV,
      confirmation: 'metis-shared-integration',
      store,
    })

    expect(plan.blockers).toEqual([
      { code: 'R2_CLEANUP_REQUIRED', count: 2 },
      { code: 'STRIPE_CLEANUP_REQUIRED', count: 1 },
    ])
    expect(store.calls).toEqual(['inspect'])
  })

  it('refuses execution blockers before starting an audit run', async () => {
    const store = new FakeStore()
    store.inspection = {
      ...EMPTY_INSPECTION,
      fixtureTenantCount: 1,
      fixtureTenantId: INTEGRATION_FIXTURE_MANIFEST.tenant.id,
      clerkOrgId: SAFE_ENV.INTEGRATION_FIXTURE_CLERK_ORG_ID,
      clerkUserIds: [SAFE_ENV.INTEGRATION_FIXTURE_CLERK_USER_ID],
      r2ObjectCount: 1,
    }

    await expect(
      executeIntegrationFixtureReset({
        env: SAFE_ENV,
        confirmation: 'metis-shared-integration',
        fixtureSetConfirmation: INTEGRATION_FIXTURE_MANIFEST.fixtureSet,
        gitCommit: 'abc123',
        store,
      })
    ).rejects.toMatchObject({
      blockers: [{ code: 'R2_CLEANUP_REQUIRED', count: 1 }],
    })
    expect(store.calls).toEqual(['inspect'])
  })

  it('requires exact fixture-set confirmation before inspection', async () => {
    const store = new FakeStore()

    await expect(
      executeIntegrationFixtureReset({
        env: SAFE_ENV,
        confirmation: 'metis-shared-integration',
        fixtureSetConfirmation: 'wrong-fixture',
        gitCommit: 'abc123',
        store,
      })
    ).rejects.toThrow('Fixture-set confirmation does not match')
    expect(store.calls).toEqual([])
  })

  it('records a successful replacement after a clean plan', async () => {
    const store = new FakeStore()

    const result = await executeIntegrationFixtureReset({
      env: SAFE_ENV,
      confirmation: 'metis-shared-integration',
      fixtureSetConfirmation: INTEGRATION_FIXTURE_MANIFEST.fixtureSet,
      gitCommit: 'abc123',
      store,
    })

    expect(result).toEqual({
      runId: 'reset-run-id',
      summary: { tenants: 1, users: 1, deals: 1 },
    })
    expect(store.calls).toEqual(['inspect', 'begin', 'replace', 'complete'])
  })

  it('records a sanitized failure after a replacement begins', async () => {
    const store = new FakeStore()
    store.replaceError = true

    await expect(
      executeIntegrationFixtureReset({
        env: SAFE_ENV,
        confirmation: 'metis-shared-integration',
        fixtureSetConfirmation: INTEGRATION_FIXTURE_MANIFEST.fixtureSet,
        gitCommit: 'abc123',
        store,
      })
    ).rejects.toBeInstanceOf(IntegrationResetRefusedError)
    expect(store.calls).toEqual(['inspect', 'begin', 'replace', 'fail'])
  })
})
