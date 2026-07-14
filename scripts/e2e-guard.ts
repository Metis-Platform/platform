import { evaluateE2eMutationGuard } from '../lib/e2e-guard'

const index = process.argv.indexOf('--confirm')
const result = evaluateE2eMutationGuard(process.env, index >= 0 ? process.argv[index + 1] : undefined)
if (!result.ok) {
  for (const error of result.errors) console.error(`E2E mutation guard: ${error}`)
  process.exitCode = 1
} else {
  console.log('E2E mutation guard passed. Browser execution remains separately configured.')
}
