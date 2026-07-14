import { evaluateIntegrationResetPreflight } from './integration-reset-guard'
import {
  INTEGRATION_FIXTURE_MANIFEST,
  type IntegrationFixtureManifest,
} from '../prisma/fixtures/integration-v1'

type EnvironmentMap = Readonly<Record<string, string | undefined>>

export interface IntegrationFixtureIdentity {
  clerkOrgId: string
  clerkUserId: string
  ownerEmail: string
}

export interface IntegrationFixtureInspection {
  fixtureTenantCount: number
  fixtureTenantId: string | null
  clerkOrgId: string | null
  clerkUserIds: string[]
  r2ObjectCount: number
  r2ObjectKeys: string[]
  stripeArtifactCount: number
  stableTenantIdConflict: boolean
  databaseRowCounts: Record<string, number>
}

export type IntegrationResetBlockerCode =
  | 'FIXTURE_TENANT_CARDINALITY'
  | 'FIXTURE_ID_DRIFT'
  | 'FIXTURE_IDENTITY_DRIFT'
  | 'STABLE_ID_CONFLICT'
  | 'R2_CLEANUP_REQUIRED'
  | 'STRIPE_CLEANUP_REQUIRED'

export interface IntegrationResetBlocker {
  code: IntegrationResetBlockerCode
  count: number
}

export interface IntegrationResetPlan {
  environmentId: string
  fixtureSet: string
  fixtureVersion: string
  requiredMigration: string
  existingRows: Record<string, number>
  willReplaceFixtureTenant: boolean
  blockers: IntegrationResetBlocker[]
}

export interface IntegrationFixtureStore {
  inspect(
    manifest: IntegrationFixtureManifest,
    identity: IntegrationFixtureIdentity
  ): Promise<IntegrationFixtureInspection>
  beginResetRun(input: {
    environmentId: string
    manifest: IntegrationFixtureManifest
    gitCommit: string
  }): Promise<string>
  replaceFixture(
    manifest: IntegrationFixtureManifest,
    identity: IntegrationFixtureIdentity,
    externalCleanup?: {
      verifiedEmptyR2Prefix: string
      replacedClerkIdentity: {
        previousOrgId: string | null
        previousUserIds: string[]
      }
    }
  ): Promise<Record<string, number>>
  completeResetRun(runId: string, summary: Record<string, number>): Promise<void>
  failResetRun(runId: string, errorCode: string): Promise<void>
}

export function matchesVerifiedPreviousClerkIdentity(
  existingOrgId: string,
  existingUserIds: readonly string[],
  verification: {
    previousOrgId: string | null
    previousUserIds: readonly string[]
  } | undefined
): boolean {
  if (!verification || verification.previousOrgId !== existingOrgId) return false
  const existing = [...existingUserIds].sort()
  const verified = [...verification.previousUserIds].sort()
  return existing.length === verified.length &&
    existing.every((userId, index) => userId === verified[index])
}

export class IntegrationResetRefusedError extends Error {
  constructor(
    message: string,
    readonly blockers: ReadonlyArray<{ code: string; count: number }> = []
  ) {
    super(message)
    this.name = 'IntegrationResetRefusedError'
  }
}

function required(env: EnvironmentMap, variable: string): string {
  const value = env[variable]?.trim()
  if (!value) throw new IntegrationResetRefusedError(`${variable} must be configured.`)
  return value
}

export function readIntegrationFixtureIdentity(env: EnvironmentMap): IntegrationFixtureIdentity {
  const ownerEmail = required(env, 'INTEGRATION_FIXTURE_OWNER_EMAIL').toLowerCase()
  if (!ownerEmail.includes('@')) {
    throw new IntegrationResetRefusedError('INTEGRATION_FIXTURE_OWNER_EMAIL must be valid.')
  }

  return {
    clerkOrgId: required(env, 'INTEGRATION_FIXTURE_CLERK_ORG_ID'),
    clerkUserId: required(env, 'INTEGRATION_FIXTURE_CLERK_USER_ID'),
    ownerEmail,
  }
}

function assertResetPreflight(env: EnvironmentMap, confirmation: string): string {
  const result = evaluateIntegrationResetPreflight(env, confirmation)
  if (!result.ok) {
    throw new IntegrationResetRefusedError(
      `Integration reset preflight failed: ${result.errors.join(' ')}`
    )
  }
  return required(env, 'METIS_ENVIRONMENT_ID')
}

export function validateIntegrationResetBoundary(
  env: EnvironmentMap,
  confirmation: string
): { environmentId: string; ownerEmail: string } {
  const ownerEmail = required(env, 'INTEGRATION_FIXTURE_OWNER_EMAIL').toLowerCase()
  if (!ownerEmail.includes('@')) {
    throw new IntegrationResetRefusedError('INTEGRATION_FIXTURE_OWNER_EMAIL must be valid.')
  }
  return { environmentId: assertResetPreflight(env, confirmation), ownerEmail }
}

export function validateIntegrationFixtureResetRequest(input: {
  env: EnvironmentMap
  confirmation: string
  fixtureSetConfirmation?: string
  manifest?: IntegrationFixtureManifest
}): { environmentId: string; identity: IntegrationFixtureIdentity } {
  const manifest = input.manifest ?? INTEGRATION_FIXTURE_MANIFEST
  if (
    input.fixtureSetConfirmation !== undefined &&
    input.fixtureSetConfirmation !== manifest.fixtureSet
  ) {
    throw new IntegrationResetRefusedError('Fixture-set confirmation does not match.')
  }

  const boundary = validateIntegrationResetBoundary(input.env, input.confirmation)
  return { environmentId: boundary.environmentId, identity: readIntegrationFixtureIdentity(input.env) }
}

export function integrationResetBlockersFor(
  inspection: IntegrationFixtureInspection,
  manifest: IntegrationFixtureManifest,
  identity: IntegrationFixtureIdentity
): IntegrationResetBlocker[] {
  const blockers: IntegrationResetBlocker[] = []

  if (inspection.fixtureTenantCount > 1) {
    blockers.push({ code: 'FIXTURE_TENANT_CARDINALITY', count: inspection.fixtureTenantCount })
  }
  if (inspection.fixtureTenantId && inspection.fixtureTenantId !== manifest.tenant.id) {
    blockers.push({ code: 'FIXTURE_ID_DRIFT', count: 1 })
  }
  if (
    inspection.clerkOrgId &&
    (inspection.clerkOrgId !== identity.clerkOrgId ||
      inspection.clerkUserIds.some(userId => userId !== identity.clerkUserId))
  ) {
    blockers.push({ code: 'FIXTURE_IDENTITY_DRIFT', count: 1 })
  }
  if (inspection.stableTenantIdConflict) {
    blockers.push({ code: 'STABLE_ID_CONFLICT', count: 1 })
  }
  if (inspection.r2ObjectCount > 0) {
    blockers.push({ code: 'R2_CLEANUP_REQUIRED', count: inspection.r2ObjectCount })
  }
  if (inspection.stripeArtifactCount > 0) {
    blockers.push({ code: 'STRIPE_CLEANUP_REQUIRED', count: inspection.stripeArtifactCount })
  }

  return blockers
}

export async function planIntegrationFixtureReset(input: {
  env: EnvironmentMap
  confirmation: string
  store: IntegrationFixtureStore
  manifest?: IntegrationFixtureManifest
}): Promise<IntegrationResetPlan> {
  const manifest = input.manifest ?? INTEGRATION_FIXTURE_MANIFEST
  const { environmentId, identity } = validateIntegrationFixtureResetRequest({
    env: input.env,
    confirmation: input.confirmation,
    manifest,
  })
  const inspection = await input.store.inspect(manifest, identity)

  return {
    environmentId,
    fixtureSet: manifest.fixtureSet,
    fixtureVersion: manifest.fixtureVersion,
    requiredMigration: manifest.requiredMigration,
    existingRows: inspection.databaseRowCounts,
    willReplaceFixtureTenant: inspection.fixtureTenantCount === 1,
    blockers: integrationResetBlockersFor(inspection, manifest, identity),
  }
}

export async function executeIntegrationFixtureReset(input: {
  env: EnvironmentMap
  confirmation: string
  fixtureSetConfirmation: string
  gitCommit: string
  store: IntegrationFixtureStore
  manifest?: IntegrationFixtureManifest
}): Promise<{ runId: string; summary: Record<string, number> }> {
  const manifest = input.manifest ?? INTEGRATION_FIXTURE_MANIFEST
  validateIntegrationFixtureResetRequest({
    env: input.env,
    confirmation: input.confirmation,
    fixtureSetConfirmation: input.fixtureSetConfirmation,
    manifest,
  })

  const plan = await planIntegrationFixtureReset({
    env: input.env,
    confirmation: input.confirmation,
    store: input.store,
    manifest,
  })
  if (plan.blockers.length > 0) {
    throw new IntegrationResetRefusedError('External cleanup or fixture repair is required.', plan.blockers)
  }

  const identity = readIntegrationFixtureIdentity(input.env)
  const runId = await input.store.beginResetRun({
    environmentId: plan.environmentId,
    manifest,
    gitCommit: input.gitCommit,
  })

  try {
    const summary = await input.store.replaceFixture(manifest, identity)
    await input.store.completeResetRun(runId, summary)
    return { runId, summary }
  } catch {
    await input.store.failResetRun(runId, 'DATABASE_REPLACEMENT_FAILED')
    throw new IntegrationResetRefusedError('Database fixture replacement failed.')
  }
}
