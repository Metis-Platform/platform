import { describe, expect, it } from 'vitest'
import { INTEGRATION_FIXTURE_MANIFEST } from '../prisma/fixtures/integration-v1'
import {
  executeFullIntegrationReset,
  planFullIntegrationReset,
  type ClerkFixtureInspection,
  type ClerkFixtureProvider,
  type R2FixtureProvider,
} from './integration-full-reset'
import type {
  IntegrationFixtureIdentity,
  IntegrationFixtureInspection,
  IntegrationFixtureStore,
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
  CLERK_SECRET_KEY: 'sk_live_integration_example',
  INTEGRATION_ALLOWED_CLERK_INSTANCE_IDS: 'ins_integration',
  PRODUCTION_CLERK_INSTANCE_IDS: 'ins_production',
  R2_ACCOUNT_ID: 'integration-account',
  R2_ACCESS_KEY_ID: 'integration-access',
  R2_SECRET_ACCESS_KEY: 'integration-secret',
  R2_BUCKET_NAME: 'metis-integration',
  INTEGRATION_ALLOWED_R2_BUCKET_NAMES: 'metis-integration',
  PRODUCTION_R2_BUCKET_NAMES: 'metis-production',
  STRIPE_SECRET_KEY: 'sk_test_example',
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_example',
  INTEGRATION_EMAIL_MODE: 'sink',
  INTEGRATION_CRON_MODE: 'disabled',
  INTEGRATION_AUCTION_MODE: 'disabled',
  INTEGRATION_AI_MODE: 'disabled',
  INTEGRATION_FIXTURE_OWNER_EMAIL: 'fixture@example.test',
  INTEGRATION_FIXTURE_OWNER_PASSWORD: 'a-long-fixture-password',
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
  cleanupProof: {
    verifiedEmptyR2Prefix: string
    replacedClerkIdentity: { previousOrgId: string | null; previousUserIds: string[] }
  } | undefined

  async inspect() {
    this.calls.push('db.inspect')
    return this.inspection
  }
  async beginResetRun() {
    this.calls.push('db.begin')
    return 'run-1'
  }
  async replaceFixture(
    _manifest: typeof INTEGRATION_FIXTURE_MANIFEST,
    _identity: IntegrationFixtureIdentity,
    cleanup?: {
      verifiedEmptyR2Prefix: string
      replacedClerkIdentity: { previousOrgId: string | null; previousUserIds: string[] }
    }
  ) {
    this.calls.push('db.replace')
    this.cleanupProof = cleanup
    if (this.replaceError) throw new Error('database failure')
    return { tenants: 1 }
  }
  async completeResetRun() {
    this.calls.push('db.complete')
  }
  async failResetRun(_runId: string, errorCode: string) {
    this.calls.push(`db.fail:${errorCode}`)
  }
}

class FakeClerk implements ClerkFixtureProvider {
  calls: string[] = []
  inspection: ClerkFixtureInspection = {
    instanceId: 'ins_integration',
    environmentType: 'production',
    organization: { state: 'tagged', id: 'org-old' },
    user: { state: 'tagged', id: 'user-old' },
  }
  recreateError = false

  async inspect() {
    this.calls.push('clerk.inspect')
    return this.inspection
  }
  async recreate() {
    this.calls.push('clerk.recreate')
    if (this.recreateError) throw new Error('clerk failure')
    return {
      clerkOrgId: 'org-new',
      clerkUserId: 'user-new',
      ownerEmail: SAFE_ENV.INTEGRATION_FIXTURE_OWNER_EMAIL,
    }
  }
}

class FakeR2 implements R2FixtureProvider {
  calls: string[] = []
  keys: string[] = []
  remainAfterDelete = false

  async listKeys(prefix: string) {
    this.calls.push(`r2.list:${prefix}`)
    return [...this.keys]
  }
  async deleteKeys(prefix: string, keys: readonly string[]) {
    if (keys.some(key => !key.startsWith(prefix))) throw new Error('scope failure')
    this.calls.push(`r2.delete:${keys.length}`)
    if (!this.remainAfterDelete) this.keys = []
  }
}

function dependencies() {
  return { store: new FakeStore(), clerk: new FakeClerk(), r2: new FakeR2() }
}

describe('full integration reset', () => {
  it('rejects an unsafe boundary before any provider or store access', async () => {
    const deps = dependencies()
    await expect(planFullIntegrationReset({
      env: { ...SAFE_ENV, APP_ENV: 'production' },
      confirmation: SAFE_ENV.METIS_ENVIRONMENT_ID,
      ...deps,
    })).rejects.toThrow('Integration reset preflight failed')
    expect(deps.store.calls).toEqual([])
    expect(deps.clerk.calls).toEqual([])
    expect(deps.r2.calls).toEqual([])
  })

  it('produces a non-mutating count-only plan', async () => {
    const deps = dependencies()
    deps.r2.keys = [`${INTEGRATION_FIXTURE_MANIFEST.r2Prefix}upload.pdf`]
    const plan = await planFullIntegrationReset({
      env: SAFE_ENV,
      confirmation: SAFE_ENV.METIS_ENVIRONMENT_ID,
      ...deps,
    })
    expect(plan).toMatchObject({
      fixtureSet: 'metis-e2e-v1',
      clerkOrganizationState: 'tagged',
      clerkUserState: 'tagged',
      r2ObjectCount: 1,
      blockers: [],
    })
    expect(deps.clerk.calls).toEqual(['clerk.inspect'])
    expect(deps.r2.calls).toEqual([`r2.list:${INTEGRATION_FIXTURE_MANIFEST.r2Prefix}`])
    expect(deps.store.calls).toEqual(['db.inspect'])
  })

  it('blocks untagged Clerk anchors before starting an audit run', async () => {
    const deps = dependencies()
    deps.clerk.inspection.organization.state = 'untagged'
    await expect(executeFullIntegrationReset({
      env: SAFE_ENV,
      confirmation: SAFE_ENV.METIS_ENVIRONMENT_ID,
      fixtureSetConfirmation: INTEGRATION_FIXTURE_MANIFEST.fixtureSet,
      gitCommit: 'abc123',
      ...deps,
    })).rejects.toMatchObject({
      blockers: [{ code: 'CLERK_ORGANIZATION_UNTAGGED', count: 1 }],
    })
    expect(deps.store.calls).toEqual(['db.inspect'])
  })

  it('blocks a secret key authenticated to a production Clerk instance', async () => {
    const deps = dependencies()
    deps.clerk.inspection.instanceId = 'ins_production'
    await expect(executeFullIntegrationReset({
      env: SAFE_ENV,
      confirmation: SAFE_ENV.METIS_ENVIRONMENT_ID,
      fixtureSetConfirmation: INTEGRATION_FIXTURE_MANIFEST.fixtureSet,
      gitCommit: 'abc123',
      ...deps,
    })).rejects.toMatchObject({
      blockers: expect.arrayContaining([
        { code: 'CLERK_PRODUCTION_INSTANCE', count: 1 },
      ]),
    })
    expect(deps.store.calls).toEqual(['db.inspect'])
  })

  it('requires a reset-only password before discovery or client work', async () => {
    const deps = dependencies()
    await expect(executeFullIntegrationReset({
      env: { ...SAFE_ENV, INTEGRATION_FIXTURE_OWNER_PASSWORD: '' },
      confirmation: SAFE_ENV.METIS_ENVIRONMENT_ID,
      fixtureSetConfirmation: INTEGRATION_FIXTURE_MANIFEST.fixtureSet,
      gitCommit: 'abc123',
      ...deps,
    })).rejects.toThrow('at least 12 characters')
    expect(deps.clerk.calls).toEqual([])
    expect(deps.r2.calls).toEqual([])
    expect(deps.store.calls).toEqual([])
  })

  it('blocks any database document key outside the exact fixture prefix', async () => {
    const deps = dependencies()
    deps.store.inspection = {
      ...EMPTY_INSPECTION,
      r2ObjectCount: 1,
      r2ObjectKeys: ['tenants/customer-tenant/private.pdf'],
    }
    const plan = await planFullIntegrationReset({
      env: SAFE_ENV,
      confirmation: SAFE_ENV.METIS_ENVIRONMENT_ID,
      ...deps,
    })
    expect(plan.blockers).toContainEqual({ code: 'R2_KEY_SCOPE_DRIFT', count: 1 })
  })

  it('never treats Clerk rotation as permission to replace a drifted fixture tenant ID', async () => {
    const deps = dependencies()
    deps.store.inspection = {
      ...EMPTY_INSPECTION,
      fixtureTenantCount: 1,
      fixtureTenantId: 'unexpected-tenant-id',
    }
    const plan = await planFullIntegrationReset({
      env: SAFE_ENV,
      confirmation: SAFE_ENV.METIS_ENVIRONMENT_ID,
      ...deps,
    })
    expect(plan.blockers).toContainEqual({ code: 'FIXTURE_ID_DRIFT', count: 1 })
  })

  it('re-verifies R2 emptiness, recreates Clerk, and passes an exact cleanup proof', async () => {
    const deps = dependencies()
    deps.r2.keys = [`${INTEGRATION_FIXTURE_MANIFEST.r2Prefix}upload.pdf`]
    deps.store.inspection = {
      ...EMPTY_INSPECTION,
      r2ObjectCount: 1,
      r2ObjectKeys: [...deps.r2.keys],
    }
    const result = await executeFullIntegrationReset({
      env: SAFE_ENV,
      confirmation: SAFE_ENV.METIS_ENVIRONMENT_ID,
      fixtureSetConfirmation: INTEGRATION_FIXTURE_MANIFEST.fixtureSet,
      gitCommit: 'abc123',
      ...deps,
    })
    expect(result.summary).toMatchObject({
      tenants: 1,
      r2ObjectsDeleted: 1,
      clerkOrganizationsRecreated: 1,
      clerkUsersRecreated: 1,
    })
    expect(deps.r2.calls).toEqual([
      `r2.list:${INTEGRATION_FIXTURE_MANIFEST.r2Prefix}`,
      'r2.delete:1',
      `r2.list:${INTEGRATION_FIXTURE_MANIFEST.r2Prefix}`,
    ])
    expect(deps.clerk.calls).toEqual(['clerk.inspect', 'clerk.recreate'])
    expect(deps.store.calls).toEqual(['db.inspect', 'db.begin', 'db.replace', 'db.complete'])
    expect(deps.store.cleanupProof).toEqual({
      verifiedEmptyR2Prefix: INTEGRATION_FIXTURE_MANIFEST.r2Prefix,
      replacedClerkIdentity: { previousOrgId: null, previousUserIds: [] },
    })
  })

  it('records an R2 failure and never reaches Clerk or database replacement', async () => {
    const deps = dependencies()
    deps.r2.keys = [`${INTEGRATION_FIXTURE_MANIFEST.r2Prefix}upload.pdf`]
    deps.r2.remainAfterDelete = true
    await expect(executeFullIntegrationReset({
      env: SAFE_ENV,
      confirmation: SAFE_ENV.METIS_ENVIRONMENT_ID,
      fixtureSetConfirmation: INTEGRATION_FIXTURE_MANIFEST.fixtureSet,
      gitCommit: 'abc123',
      ...deps,
    })).rejects.toThrow('failed during R2')
    expect(deps.clerk.calls).toEqual(['clerk.inspect'])
    expect(deps.store.calls).toEqual(['db.inspect', 'db.begin', 'db.fail:FULL_RESET_R2_FAILED'])
  })

  it('records a retryable Clerk failure after R2 is clean', async () => {
    const deps = dependencies()
    deps.clerk.recreateError = true
    await expect(executeFullIntegrationReset({
      env: SAFE_ENV,
      confirmation: SAFE_ENV.METIS_ENVIRONMENT_ID,
      fixtureSetConfirmation: INTEGRATION_FIXTURE_MANIFEST.fixtureSet,
      gitCommit: 'abc123',
      ...deps,
    })).rejects.toThrow('failed during CLERK')
    expect(deps.store.calls).toEqual(['db.inspect', 'db.begin', 'db.fail:FULL_RESET_CLERK_FAILED'])
  })
})
