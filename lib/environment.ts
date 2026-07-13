export const APP_ENVIRONMENTS = [
  'local',
  'preview',
  'integration',
  'release-candidate',
  'production',
  'test',
] as const

export type AppEnvironment = (typeof APP_ENVIRONMENTS)[number]

export interface EnvironmentIdentity {
  appEnvironment: AppEnvironment
  environmentId: string
  isProduction: boolean
  label: string
}

type EnvironmentSource = {
  APP_ENV?: string
  METIS_ENVIRONMENT_ID?: string
}

const ENVIRONMENT_LABELS: Record<AppEnvironment, string> = {
  local: 'Local Development',
  preview: 'Preview',
  integration: 'Shared Integration — Disposable Synthetic Data',
  'release-candidate': 'Release Candidate',
  production: 'Production',
  test: 'Automated Test',
}

export function parseAppEnvironment(value: string | undefined): AppEnvironment {
  const normalized = value?.trim().toLowerCase() || 'local'

  if (APP_ENVIRONMENTS.includes(normalized as AppEnvironment)) {
    return normalized as AppEnvironment
  }

  throw new Error(
    `Invalid APP_ENV "${value}". Expected one of: ${APP_ENVIRONMENTS.join(', ')}.`
  )
}

export function getEnvironmentIdentity(
  env: EnvironmentSource = process.env as EnvironmentSource
): EnvironmentIdentity {
  const appEnvironment = parseAppEnvironment(env.APP_ENV)
  const configuredId = env.METIS_ENVIRONMENT_ID?.trim()

  return {
    appEnvironment,
    environmentId: configuredId || appEnvironment,
    isProduction: appEnvironment === 'production',
    label: ENVIRONMENT_LABELS[appEnvironment],
  }
}
