import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { evaluateIntegrationResetPreflight } from './integration-reset-guard'
import { loadLocalOperatorEnvironment } from './local-operator-env'

const temporaryDirectories: string[] = []

function localEnvironmentFile(contents: string): string {
  const directory = mkdtempSync(join(tmpdir(), 'metis-local-operator-env-'))
  temporaryDirectories.push(directory)
  const path = join(directory, '.env.local')
  writeFileSync(path, contents)
  return path
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('loadLocalOperatorEnvironment', () => {
  it('loads local operator configuration into an otherwise empty environment', () => {
    const env: Record<string, string | undefined> = {}

    loadLocalOperatorEnvironment(
      env,
      localEnvironmentFile('METIS_ENVIRONMENT_ID=metis-qa\nAPP_ENV=integration\n')
    )

    expect(env).toMatchObject({
      METIS_ENVIRONMENT_ID: 'metis-qa',
      APP_ENV: 'integration',
    })
  })

  it('preserves explicit shell or CI values over the local file', () => {
    const env: Record<string, string | undefined> = {
      METIS_ENVIRONMENT_ID: 'shell-qa',
    }

    loadLocalOperatorEnvironment(
      env,
      localEnvironmentFile('METIS_ENVIRONMENT_ID=file-qa\nAPP_ENV=integration\n')
    )

    expect(env).toMatchObject({
      METIS_ENVIRONMENT_ID: 'shell-qa',
      APP_ENV: 'integration',
    })
  })

  it('provides the configured identities to the non-mutating preflight', () => {
    const env: Record<string, string | undefined> = {}

    loadLocalOperatorEnvironment(env, localEnvironmentFile([
      'APP_ENV=integration',
      'METIS_ENVIRONMENT_ID=metis-qa',
      'INTEGRATION_RESET_AUTHORIZED_ENVIRONMENT_ID=metis-qa',
      'DATABASE_URL=postgresql://user:pass@qa.example.test/metis',
      'INTEGRATION_ALLOWED_DATABASE_HOSTS=qa.example.test',
      'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_cWEuZXhhbXBsZS50ZXN0JA',
      'INTEGRATION_ALLOWED_CLERK_INSTANCE_HOSTS=qa.example.test',
      'R2_BUCKET_NAME=metis-qa',
      'INTEGRATION_ALLOWED_R2_BUCKET_NAMES=metis-qa',
      'STRIPE_SECRET_KEY=sk_test_example',
      'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_example',
      'INTEGRATION_EMAIL_MODE=sink',
      'INTEGRATION_CRON_MODE=disabled',
      'INTEGRATION_AUCTION_MODE=disabled',
      'INTEGRATION_AI_MODE=disabled',
    ].join('\n')))

    expect(evaluateIntegrationResetPreflight(env, 'metis-qa')).toEqual({
      ok: true,
      errors: [],
    })
  })
})
