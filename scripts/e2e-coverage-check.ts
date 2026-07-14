import { missingE2eCoverageSpecs, readE2eCoverage } from '../lib/e2e-coverage'

const result = readE2eCoverage()
if (!result.success) {
  console.error(JSON.stringify(result.error.flatten(), null, 2))
  process.exitCode = 1
} else {
  const missingSpecs = missingE2eCoverageSpecs(result.data)
  if (missingSpecs.length) {
    console.error(`E2E coverage references missing specs: ${missingSpecs.join(', ')}`)
    process.exitCode = 1
  } else {
  console.log(`E2E coverage contract passed for ${result.data.stories.length} stories.`)
  }
}
