import { spawnSync } from 'node:child_process'
import { evaluateE2eReadOnlyGuard } from '../lib/e2e-readonly-guard'

const result = evaluateE2eReadOnlyGuard(process.env)
if (!result.ok) {
  for (const error of result.errors) console.error(`E2E read-only guard: ${error}`)
  process.exitCode = 1
} else {
  const command = process.platform === 'win32' ? 'node_modules/.bin/playwright.cmd' : 'node_modules/.bin/playwright'
  const run = spawnSync(command, ['test', ...process.argv.slice(2)], { stdio: 'inherit', env: process.env })
  process.exitCode = run.status ?? 1
}
