import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { z } from 'zod'
import { readE2eCoverage } from './e2e-coverage'

const entrySchema = z.object({
  target: z.string().startsWith('app/api/').endsWith('/route.ts'),
  status: z.enum(['covered', 'deferred', 'excluded']),
  storyId: z.string().min(1).optional(),
  issue: z.string().regex(/^#\d+$/).optional(),
  reason: z.string().min(1).optional(),
}).superRefine((entry, context) => {
  if (entry.status === 'covered' && !entry.storyId) {
    context.addIssue({ code: 'custom', message: 'Covered mutations require a catalog story ID.' })
  }
  if (entry.status !== 'covered' && (!entry.issue || !entry.reason)) {
    context.addIssue({ code: 'custom', message: 'Deferred and excluded mutations require an issue and rationale.' })
  }
})

const inventorySchema = z.object({
  version: z.literal(1),
  scope: z.literal('app-api-mutations'),
  entries: z.array(entrySchema).min(1),
}).superRefine((inventory, context) => {
  const seen = new Set<string>()
  for (const entry of inventory.entries) {
    if (seen.has(entry.target)) context.addIssue({ code: 'custom', message: `Duplicate mutation inventory target: ${entry.target}` })
    seen.add(entry.target)
  }
})

export type FeatureVerificationInventory = z.infer<typeof inventorySchema>

export function validateFeatureVerificationInventory(value: unknown) {
  return inventorySchema.safeParse(value)
}

export function readFeatureVerificationInventory(path = 'e2e/mutation-inventory.json') {
  return validateFeatureVerificationInventory(JSON.parse(readFileSync(path, 'utf8')))
}

export function discoverMutationRouteTargets(root = 'app/api'): string[] {
  return walk(root).filter(path => {
    if (!path.endsWith('/route.ts')) return false
    return /export async function (POST|PUT|PATCH|DELETE)\b/.test(readFileSync(path, 'utf8'))
  }).sort()
}

export function featureVerificationInventoryGaps(
  inventory: FeatureVerificationInventory,
  mutationTargets: string[],
  knownStoryIds: Set<string>,
  specExists: (path: string) => boolean = existsSync,
  storySpecs: Map<string, string> = storySpecMap(),
) {
  const entries = new Map(inventory.entries.map(entry => [entry.target, entry]))
  const missingTargets = mutationTargets.filter(target => !entries.has(target))
  const unknownTargets = inventory.entries.map(entry => entry.target).filter(target => !mutationTargets.includes(target))
  const invalidStoryIds = inventory.entries
    .filter(entry => entry.status === 'covered' && (!entry.storyId || !knownStoryIds.has(entry.storyId)))
    .map(entry => entry.target)
  const missingSpecs = inventory.entries
    .filter(entry => entry.status === 'covered' && entry.storyId)
    .filter(entry => !specExists(storySpecs.get(entry.storyId!) ?? ''))
    .map(entry => entry.target)

  return { missingTargets, unknownTargets, invalidStoryIds, missingSpecs }
}

function storySpecMap() {
  const coverage = readE2eCoverage()
  if (!coverage.success) return new Map<string, string>()
  return new Map(coverage.data.stories.map(story => [story.id, story.spec]))
}

function walk(root: string): string[] {
  if (!existsSync(root)) return []
  return readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    const path = join(root, entry.name)
    return entry.isDirectory() ? walk(path) : [relative('.', path).split(sep).join('/')]
  })
}
