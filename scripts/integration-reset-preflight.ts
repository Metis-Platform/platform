import { evaluateIntegrationResetPreflight } from '../lib/integration-reset-guard'
import { loadLocalOperatorEnvironment } from '../lib/local-operator-env'

loadLocalOperatorEnvironment()
const args = process.argv.slice(2)
const confirmIndex = args.indexOf('--confirm')
const confirmation = confirmIndex >= 0 ? args[confirmIndex + 1] : undefined
const result = evaluateIntegrationResetPreflight(process.env, confirmation)

if (!result.ok) {
  console.error('Integration reset preflight refused to continue:')
  for (const error of result.errors) console.error(`- ${error}`)
  process.exitCode = 1
} else {
  console.log('Integration identity and declared-policy preflight passed. No state was changed.')
  console.log('This does not authorize a reset; fixture and cross-service cleanup gates still apply under #289.')
}
