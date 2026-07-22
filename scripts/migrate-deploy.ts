import { spawnSync } from 'node:child_process'
import { isTransientMigrationConnectivityFailure } from '../lib/migration-connectivity-retry'

const attempts = 2
const retryDelayMs = 10_000

function runMigration() {
  const result = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
    encoding: 'utf8',
    env: process.env,
  })
  process.stdout.write(result.stdout ?? '')
  process.stderr.write(result.stderr ?? '')
  return result
}

async function main() {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const result = runMigration()
    if (result.status === 0) return

    const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}\n${result.error?.message ?? ''}`
    if (attempt === attempts || !isTransientMigrationConnectivityFailure(output)) {
      process.exitCode = result.status ?? 1
      return
    }

    console.warn(`Transient database connectivity failure; retrying migration in ${retryDelayMs / 1000}s (attempt ${attempt + 1}/${attempts}).`)
    await new Promise(resolve => setTimeout(resolve, retryDelayMs))
  }
}

void main()
