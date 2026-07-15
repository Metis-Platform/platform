import { execFileSync } from 'node:child_process'
import { createSeedPrismaClient } from '../prisma/seeds/db'
import { PrismaIntegrationFixtureStore } from '../prisma/integration-fixture-store'
import { INTEGRATION_FIXTURE_MANIFEST } from '../prisma/fixtures/integration-v1'
import {
  executeFullIntegrationReset,
  planFullIntegrationReset,
  validateFullIntegrationResetRequest,
} from '../lib/integration-full-reset'
import { IntegrationResetRefusedError } from '../lib/integration-fixture-reset'
import {
  createClerkFixtureProvider,
  createR2FixtureProvider,
} from '../lib/integration-fixture-providers'
import { loadLocalOperatorEnvironment } from '../lib/local-operator-env'

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function currentCommit(): string {
  return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
}

async function main() {
  loadLocalOperatorEnvironment()
  const execute = process.argv.includes('--execute')
  const confirmation = argument('--confirm-environment') ?? ''
  const fixtureSetConfirmation = argument('--confirm-fixture') ?? ''

  // Validate every non-secret safety input before constructing provider/database clients.
  validateFullIntegrationResetRequest({
    env: process.env,
    confirmation,
    fixtureSetConfirmation: execute ? fixtureSetConfirmation : undefined,
  })

  const prisma = createSeedPrismaClient()
  const store = new PrismaIntegrationFixtureStore(prisma)
  const clerk = createClerkFixtureProvider(process.env)
  const r2 = createR2FixtureProvider(process.env)

  try {
    if (!execute) {
      const plan = await planFullIntegrationReset({
        env: process.env,
        confirmation,
        store,
        clerk,
        r2,
      })
      console.log(JSON.stringify({ mode: 'plan', mutating: false, ...plan }, null, 2))
      return
    }

    const result = await executeFullIntegrationReset({
      env: process.env,
      confirmation,
      fixtureSetConfirmation,
      gitCommit: currentCommit(),
      store,
      clerk,
      r2,
    })
    console.log(JSON.stringify({
      mode: 'execute',
      fixtureSet: INTEGRATION_FIXTURE_MANIFEST.fixtureSet,
      fixtureVersion: INTEGRATION_FIXTURE_MANIFEST.fixtureVersion,
      ...result,
    }, null, 2))
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(error => {
  if (error instanceof IntegrationResetRefusedError) {
    console.error(JSON.stringify({
      ok: false,
      error: error.message,
      blockers: error.blockers,
    }, null, 2))
  } else {
    console.error(JSON.stringify({ ok: false, error: 'Full integration reset command failed.' }))
  }
  process.exitCode = 1
})
