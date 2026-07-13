import { parseAppEnvironment, type AppEnvironment } from './environment'

export type RuntimeEnvironment = Readonly<Record<string, string | undefined>>
export type GuardedSideEffect = 'cron' | 'auction' | 'ai'
export type EmailDeliveryPolicy = 'send' | 'sink'

const GUARDED_ENVIRONMENTS = new Set<AppEnvironment>([
  'preview',
  'integration',
  'release-candidate',
  'test',
])

const MODE_VARIABLES: Record<GuardedSideEffect, string> = {
  cron: 'INTEGRATION_CRON_MODE',
  auction: 'INTEGRATION_AUCTION_MODE',
  ai: 'INTEGRATION_AI_MODE',
}

export class SideEffectPolicyError extends Error {
  constructor(readonly sideEffect: GuardedSideEffect | 'email' | 'environment') {
    super(`${sideEffect} is blocked by the environment side-effect policy`)
    this.name = 'SideEffectPolicyError'
  }
}

function logicalEnvironment(env: RuntimeEnvironment): AppEnvironment {
  const configured = env.APP_ENV?.trim()
  const hosted = env.VERCEL === '1' || Boolean(env.VERCEL_ENV)
  if (!configured && hosted) {
    throw new SideEffectPolicyError('environment')
  }
  const environment = parseAppEnvironment(configured)

  if (hosted && environment === 'local') {
    throw new SideEffectPolicyError('environment')
  }

  if (environment === 'production') {
    const environmentId = env.METIS_ENVIRONMENT_ID?.trim()
    const authorizedId = env.PRODUCTION_AUTHORIZED_ENVIRONMENT_ID?.trim()
    if (!environmentId || !authorizedId || environmentId !== authorizedId) {
      throw new SideEffectPolicyError('environment')
    }
  }

  return environment
}

function isGuarded(env: RuntimeEnvironment): boolean {
  return GUARDED_ENVIRONMENTS.has(logicalEnvironment(env))
}

export function assertSideEffectAllowed(
  sideEffect: GuardedSideEffect,
  env: RuntimeEnvironment = process.env
): void {
  if (!isGuarded(env)) return
  if (env[MODE_VARIABLES[sideEffect]]?.trim() !== 'enabled') {
    throw new SideEffectPolicyError(sideEffect)
  }
}

export function resolveEmailDeliveryPolicy(
  recipients: string[],
  env: RuntimeEnvironment = process.env
): EmailDeliveryPolicy {
  if (!isGuarded(env)) return 'send'

  const mode = env.INTEGRATION_EMAIL_MODE?.trim()
  if (mode === 'sink') return 'sink'
  if (mode !== 'allowlist') throw new SideEffectPolicyError('email')

  const allowlist = new Set(
    (env.INTEGRATION_EMAIL_ALLOWLIST ?? '')
      .split(',')
      .map(email => email.trim().toLowerCase())
      .filter(Boolean)
  )
  const normalizedRecipients = recipients.map(email => email.trim().toLowerCase()).filter(Boolean)

  if (normalizedRecipients.length === 0 || normalizedRecipients.some(email => !allowlist.has(email))) {
    throw new SideEffectPolicyError('email')
  }

  return 'send'
}
