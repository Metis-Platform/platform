import { execFileSync } from 'node:child_process'
import { createSeedPrismaClient } from '../prisma/seeds/db'
import { PrismaIntegrationFixtureStore } from '../prisma/integration-fixture-store'
import { INTEGRATION_FIXTURE_MANIFEST } from '../prisma/fixtures/integration-v1'
import {
  executeIntegrationFixtureReset,
  IntegrationResetRefusedError,
  planIntegrationFixtureReset,
  validateIntegrationFixtureResetRequest,
} from '../lib/integration-fixture-reset'

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function currentCommit(): string {
  return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
}

async function main() {
  const execute = process.argv.includes('--execute')
  const confirmation = argument('--confirm-environment') ?? ''
  const fixtureSetConfirmation = argument('--confirm-fixture') ?? ''

  // Keep the safety boundary independent of Prisma and DATABASE_URL parsing.
  // An unsafe or incomplete environment must fail before a client can connect.
  validateIntegrationFixtureResetRequest({
    env: process.env,
    confirmation,
    fixtureSetConfirmation: execute ? fixtureSetConfirmation : undefined,
  })

  const prisma = createSeedPrismaClient()
  const store = new PrismaIntegrationFixtureStore(prisma)

  try {
    if (!execute) {
      const plan = await planIntegrationFixtureReset({
        env: process.env,
        confirmation,
        store,
      })
      console.log(JSON.stringify({ mode: 'plan', mutating: false, ...plan }, null, 2))
      return
    }

    const result = await executeIntegrationFixtureReset({
      env: process.env,
      confirmation,
      fixtureSetConfirmation,
      gitCommit: currentCommit(),
      store,
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
    console.error(JSON.stringify({ ok: false, error: 'Integration fixture command failed.' }))
  }
  process.exitCode = 1
})
