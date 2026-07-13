type EnvironmentMap = Readonly<Record<string, string | undefined>>

export interface IntegrationResetPreflightResult {
  ok: boolean
  errors: string[]
}

interface ServiceIdentityRule {
  label: string
  resolveIdentity: (env: EnvironmentMap) => string
  integrationAllowlistVariable: string
  productionDenylistVariable: string
}

const SERVICE_IDENTITY_RULES: ServiceIdentityRule[] = [
  {
    label: 'Database host',
    resolveIdentity: env => databaseHost(env.DATABASE_URL),
    integrationAllowlistVariable: 'INTEGRATION_ALLOWED_DATABASE_HOSTS',
    productionDenylistVariable: 'PRODUCTION_DATABASE_HOSTS',
  },
  {
    label: 'Clerk instance',
    resolveIdentity: env => clerkInstanceHost(env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY),
    integrationAllowlistVariable: 'INTEGRATION_ALLOWED_CLERK_INSTANCE_HOSTS',
    productionDenylistVariable: 'PRODUCTION_CLERK_INSTANCE_HOSTS',
  },
  {
    label: 'R2 bucket',
    resolveIdentity: env => value(env, 'R2_BUCKET_NAME'),
    integrationAllowlistVariable: 'INTEGRATION_ALLOWED_R2_BUCKET_NAMES',
    productionDenylistVariable: 'PRODUCTION_R2_BUCKET_NAMES',
  },
]

const DISABLED_SIDE_EFFECT_RULES = [
  ['INTEGRATION_CRON_MODE', 'Cron'],
  ['INTEGRATION_AUCTION_MODE', 'Auction feed'],
  ['INTEGRATION_AI_MODE', 'AI'],
] as const

function value(env: EnvironmentMap, variable: string): string {
  return env[variable]?.trim() ?? ''
}

function list(env: EnvironmentMap, variable: string): Set<string> {
  return new Set(
    value(env, variable)
      .split(',')
      .map(item => item.trim())
      .filter(Boolean)
  )
}

function databaseHost(databaseUrl: string | undefined): string {
  if (!databaseUrl) return ''
  try {
    return new URL(databaseUrl).hostname.toLowerCase()
  } catch {
    return ''
  }
}

function clerkInstanceHost(publishableKey: string | undefined): string {
  const encoded = publishableKey?.match(/^pk_(?:test|live)_(.+)$/)?.[1]
  if (!encoded) return ''

  try {
    const host = Buffer.from(encoded, 'base64url')
      .toString('utf8')
      .replace(/\$$/, '')
      .toLowerCase()
    return /^[a-z0-9.-]+$/.test(host) ? host : ''
  } catch {
    return ''
  }
}

export function evaluateIntegrationResetPreflight(
  env: EnvironmentMap,
  confirmedEnvironmentId: string | undefined
): IntegrationResetPreflightResult {
  const errors: string[] = []

  if (value(env, 'APP_ENV') !== 'integration') {
    errors.push('APP_ENV must be exactly "integration".')
  }

  const environmentId = value(env, 'METIS_ENVIRONMENT_ID')
  const authorizedEnvironmentId = value(env, 'INTEGRATION_RESET_AUTHORIZED_ENVIRONMENT_ID')
  const confirmation = confirmedEnvironmentId?.trim() ?? ''

  if (!environmentId) {
    errors.push('METIS_ENVIRONMENT_ID must identify the integration environment.')
  }
  if (!authorizedEnvironmentId) {
    errors.push('INTEGRATION_RESET_AUTHORIZED_ENVIRONMENT_ID must be configured.')
  }
  if (!confirmation) {
    errors.push('The operator must explicitly confirm the integration environment ID.')
  }
  if (
    environmentId &&
    authorizedEnvironmentId &&
    confirmation &&
    (environmentId !== authorizedEnvironmentId || environmentId !== confirmation)
  ) {
    errors.push('Environment identity, reset authorization, and operator confirmation must match.')
  }

  for (const rule of SERVICE_IDENTITY_RULES) {
    const identity = rule.resolveIdentity(env)
    const integrationAllowlist = list(env, rule.integrationAllowlistVariable)
    const productionDenylist = list(env, rule.productionDenylistVariable)

    if (!identity) {
      errors.push(`${rule.label} identity is missing.`)
      continue
    }
    if (!integrationAllowlist.has(identity)) {
      errors.push(`${rule.label} identity is not in the integration allowlist.`)
    }
    if (productionDenylist.has(identity)) {
      errors.push(`${rule.label} identity is denylisted as production.`)
    }
  }

  if (!value(env, 'STRIPE_SECRET_KEY').startsWith('sk_test_')) {
    errors.push('Stripe must use a test-mode secret key.')
  }
  if (!value(env, 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY').startsWith('pk_test_')) {
    errors.push('Stripe must use a test-mode publishable key.')
  }

  const emailMode = value(env, 'INTEGRATION_EMAIL_MODE')
  if (emailMode !== 'sink' && emailMode !== 'allowlist') {
    errors.push('INTEGRATION_EMAIL_MODE must be "sink" or "allowlist".')
  }

  for (const [variable, label] of DISABLED_SIDE_EFFECT_RULES) {
    if (value(env, variable) !== 'disabled') {
      errors.push(`${label} side effects must be disabled.`)
    }
  }

  return { ok: errors.length === 0, errors }
}
