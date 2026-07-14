import {
  IntegrationResetRefusedError,
  integrationResetBlockersFor,
  validateIntegrationResetBoundary,
  type IntegrationFixtureIdentity,
  type IntegrationFixtureInspection,
  type IntegrationFixtureStore,
  type IntegrationResetBlocker,
} from './integration-fixture-reset'
import {
  INTEGRATION_FIXTURE_MANIFEST,
  type IntegrationFixtureManifest,
} from '../prisma/fixtures/integration-v1'

type EnvironmentMap = Readonly<Record<string, string | undefined>>
export type FixtureResourceState = 'missing' | 'tagged' | 'untagged'

export interface ClerkFixtureInspection {
  instanceId: string
  environmentType: string
  organization: { state: FixtureResourceState; id: string | null }
  user: { state: FixtureResourceState; id: string | null }
}

export interface ClerkFixtureProvider {
  inspect(manifest: IntegrationFixtureManifest): Promise<ClerkFixtureInspection>
  recreate(input: {
    manifest: IntegrationFixtureManifest
    ownerEmail: string
    ownerPassword: string
  }): Promise<IntegrationFixtureIdentity>
}

export interface R2FixtureProvider {
  listKeys(prefix: string): Promise<string[]>
  deleteKeys(prefix: string, keys: readonly string[]): Promise<void>
}

export type FullResetBlockerCode =
  | IntegrationResetBlocker['code']
  | 'CLERK_ORGANIZATION_UNTAGGED'
  | 'CLERK_USER_UNTAGGED'
  | 'CLERK_INSTANCE_NOT_ALLOWED'
  | 'CLERK_PRODUCTION_INSTANCE'
  | 'R2_KEY_SCOPE_DRIFT'

export interface FullResetBlocker {
  code: FullResetBlockerCode
  count: number
}

export interface FullIntegrationResetPlan {
  environmentId: string
  fixtureSet: string
  fixtureVersion: string
  requiredMigration: string
  clerkInstanceId: string
  clerkEnvironmentType: string
  clerkOrganizationState: FixtureResourceState
  clerkUserState: FixtureResourceState
  r2Prefix: string
  r2ObjectCount: number
  databaseRows: Record<string, number>
  blockers: FullResetBlocker[]
}

interface PlanEvidence {
  plan: FullIntegrationResetPlan
  inspection: IntegrationFixtureInspection
  r2Keys: string[]
  ownerEmail: string
}

function exactFixtureConfirmation(
  fixtureSetConfirmation: string,
  manifest: IntegrationFixtureManifest
) {
  if (fixtureSetConfirmation !== manifest.fixtureSet) {
    throw new IntegrationResetRefusedError('Fixture-set confirmation does not match.')
  }
}

function requireOwnerPassword(env: EnvironmentMap): string {
  const password = env.INTEGRATION_FIXTURE_OWNER_PASSWORD?.trim()
  if (!password || password.length < 12) {
    throw new IntegrationResetRefusedError(
      'INTEGRATION_FIXTURE_OWNER_PASSWORD must contain at least 12 characters.'
    )
  }
  return password
}

function requiredValue(env: EnvironmentMap, variable: string): string {
  const value = env[variable]?.trim()
  if (!value) throw new IntegrationResetRefusedError(`${variable} must be configured.`)
  return value
}

function configuredIdentities(env: EnvironmentMap, variable: string): Set<string> {
  return new Set(requiredValue(env, variable).split(',').map(value => value.trim()).filter(Boolean))
}

function optionalIdentities(env: EnvironmentMap, variable: string): Set<string> {
  return new Set((env[variable] ?? '').split(',').map(value => value.trim()).filter(Boolean))
}

export function validateFullIntegrationResetRequest(input: {
  env: EnvironmentMap
  confirmation: string
  fixtureSetConfirmation?: string
  manifest?: IntegrationFixtureManifest
}): { environmentId: string; ownerEmail: string } {
  const manifest = input.manifest ?? INTEGRATION_FIXTURE_MANIFEST
  for (const variable of [
    'CLERK_SECRET_KEY',
    'R2_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'INTEGRATION_ALLOWED_CLERK_INSTANCE_IDS',
  ]) {
    requiredValue(input.env, variable)
  }
  if (input.fixtureSetConfirmation !== undefined) {
    exactFixtureConfirmation(input.fixtureSetConfirmation, manifest)
    requireOwnerPassword(input.env)
  }
  return validateIntegrationResetBoundary(input.env, input.confirmation)
}

async function gatherPlanEvidence(input: {
  env: EnvironmentMap
  confirmation: string
  store: IntegrationFixtureStore
  clerk: ClerkFixtureProvider
  r2: R2FixtureProvider
  manifest: IntegrationFixtureManifest
}): Promise<PlanEvidence> {
  const boundary = validateFullIntegrationResetRequest({
    env: input.env,
    confirmation: input.confirmation,
    manifest: input.manifest,
  })
  const [clerkInspection, r2Keys] = await Promise.all([
    input.clerk.inspect(input.manifest),
    input.r2.listKeys(input.manifest.r2Prefix),
  ])
  const provisionalIdentity: IntegrationFixtureIdentity = {
    clerkOrgId: clerkInspection.organization.id ?? '',
    clerkUserId: clerkInspection.user.id ?? '',
    ownerEmail: boundary.ownerEmail,
  }
  const inspection = await input.store.inspect(input.manifest, provisionalIdentity)
  const blockers: FullResetBlocker[] = integrationResetBlockersFor(
    inspection,
    input.manifest,
    provisionalIdentity
  ).filter(blocker =>
    blocker.code !== 'R2_CLEANUP_REQUIRED' && blocker.code !== 'FIXTURE_IDENTITY_DRIFT'
  )

  if (clerkInspection.organization.state === 'untagged') {
    blockers.push({ code: 'CLERK_ORGANIZATION_UNTAGGED', count: 1 })
  }
  if (clerkInspection.user.state === 'untagged') {
    blockers.push({ code: 'CLERK_USER_UNTAGGED', count: 1 })
  }
  const allowedClerkInstances = configuredIdentities(
    input.env,
    'INTEGRATION_ALLOWED_CLERK_INSTANCE_IDS'
  )
  const productionClerkInstances = optionalIdentities(input.env, 'PRODUCTION_CLERK_INSTANCE_IDS')
  if (!allowedClerkInstances.has(clerkInspection.instanceId)) {
    blockers.push({ code: 'CLERK_INSTANCE_NOT_ALLOWED', count: 1 })
  }
  if (productionClerkInstances.has(clerkInspection.instanceId)) {
    blockers.push({ code: 'CLERK_PRODUCTION_INSTANCE', count: 1 })
  }
  const outOfScopeKeyCount = [
    ...inspection.r2ObjectKeys,
    ...r2Keys,
  ].filter(key => !key.startsWith(input.manifest.r2Prefix)).length
  if (outOfScopeKeyCount > 0) {
    blockers.push({ code: 'R2_KEY_SCOPE_DRIFT', count: outOfScopeKeyCount })
  }

  return {
    plan: {
      environmentId: boundary.environmentId,
      fixtureSet: input.manifest.fixtureSet,
      fixtureVersion: input.manifest.fixtureVersion,
      requiredMigration: input.manifest.requiredMigration,
      clerkInstanceId: clerkInspection.instanceId,
      clerkEnvironmentType: clerkInspection.environmentType,
      clerkOrganizationState: clerkInspection.organization.state,
      clerkUserState: clerkInspection.user.state,
      r2Prefix: input.manifest.r2Prefix,
      r2ObjectCount: r2Keys.length,
      databaseRows: inspection.databaseRowCounts,
      blockers,
    },
    inspection,
    r2Keys,
    ownerEmail: boundary.ownerEmail,
  }
}

export async function planFullIntegrationReset(input: {
  env: EnvironmentMap
  confirmation: string
  store: IntegrationFixtureStore
  clerk: ClerkFixtureProvider
  r2: R2FixtureProvider
  manifest?: IntegrationFixtureManifest
}): Promise<FullIntegrationResetPlan> {
  const manifest = input.manifest ?? INTEGRATION_FIXTURE_MANIFEST
  return (await gatherPlanEvidence({ ...input, manifest })).plan
}

export async function executeFullIntegrationReset(input: {
  env: EnvironmentMap
  confirmation: string
  fixtureSetConfirmation: string
  gitCommit: string
  store: IntegrationFixtureStore
  clerk: ClerkFixtureProvider
  r2: R2FixtureProvider
  manifest?: IntegrationFixtureManifest
}): Promise<{ runId: string; summary: Record<string, number> }> {
  const manifest = input.manifest ?? INTEGRATION_FIXTURE_MANIFEST
  validateFullIntegrationResetRequest({
    env: input.env,
    confirmation: input.confirmation,
    fixtureSetConfirmation: input.fixtureSetConfirmation,
    manifest,
  })
  const ownerPassword = requireOwnerPassword(input.env)
  const evidence = await gatherPlanEvidence({ ...input, manifest })
  if (evidence.plan.blockers.length > 0) {
    throw new IntegrationResetRefusedError(
      'Cross-service cleanup or fixture repair is required.',
      evidence.plan.blockers
    )
  }

  const runId = await input.store.beginResetRun({
    environmentId: evidence.plan.environmentId,
    manifest,
    gitCommit: input.gitCommit,
  })
  let phase = 'R2'

  try {
    await input.r2.deleteKeys(manifest.r2Prefix, evidence.r2Keys)
    const remainingKeys = await input.r2.listKeys(manifest.r2Prefix)
    if (remainingKeys.length > 0) throw new Error('R2 fixture prefix is not empty')

    phase = 'CLERK'
    const identity = await input.clerk.recreate({
      manifest,
      ownerEmail: evidence.ownerEmail,
      ownerPassword,
    })

    phase = 'DATABASE'
    const databaseSummary = await input.store.replaceFixture(manifest, identity, {
      verifiedEmptyR2Prefix: manifest.r2Prefix,
      replacedClerkIdentity: {
        previousOrgId: evidence.inspection.clerkOrgId,
        previousUserIds: evidence.inspection.clerkUserIds,
      },
    })
    const summary = {
      ...databaseSummary,
      r2ObjectsDeleted: evidence.r2Keys.length,
      clerkOrganizationsRecreated: 1,
      clerkUsersRecreated: 1,
    }
    phase = 'AUDIT'
    await input.store.completeResetRun(runId, summary)
    return { runId, summary }
  } catch {
    try {
      await input.store.failResetRun(runId, `FULL_RESET_${phase}_FAILED`)
    } catch {
      // Preserve the sanitized reset failure even if audit finalization also fails.
    }
    throw new IntegrationResetRefusedError(`Full integration reset failed during ${phase}.`)
  }
}
