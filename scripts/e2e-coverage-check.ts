import { missingE2eCoverageSpecs, readE2eCoverage } from '../lib/e2e-coverage'
import {
  discoverMutationRouteTargets,
  discoverServerActionTargets,
  featureVerificationInventoryGaps,
  readFeatureVerificationInventory,
} from '../lib/feature-verification-inventory'

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
    const inventory = readFeatureVerificationInventory()
    if (!inventory.success) {
      console.error(JSON.stringify(inventory.error.flatten(), null, 2))
      process.exitCode = 1
    } else {
      const gaps = featureVerificationInventoryGaps(
        inventory.data,
        discoverMutationRouteTargets(),
        new Set(result.data.stories.map(story => story.id)),
      )
      const actions = readFeatureVerificationInventory('e2e/server-action-inventory.json')
      const actionGaps = actions.success ? featureVerificationInventoryGaps(actions.data, discoverServerActionTargets(), new Set(result.data.stories.map(story => story.id))) : null
      if (!actions.success || Object.values(gaps).some(gap => gap.length > 0) || actionGaps && Object.values(actionGaps).some(gap => gap.length > 0)) {
        console.error(`Feature-verification inventory gaps: ${JSON.stringify({ routes: gaps, actions: actionGaps, actionSchema: actions.success ? undefined : actions.error.flatten() })}`)
        process.exitCode = 1
      } else {
        console.log(`E2E coverage contract passed for ${result.data.stories.length} stories, ${inventory.data.entries.length} mutation routes, and ${actions.data.entries.length} server-action modules.`)
      }
    }
  }
}
