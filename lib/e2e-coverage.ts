import { existsSync, readFileSync } from 'node:fs'
import { z } from 'zod'

const mutationEvidenceSchema = z.object({
  fixtureSet: z.string().min(1),
  responseHeader: z.literal('x-request-id'),
  auditAction: z.string().min(1),
})

const storySchema = z.object({
  id: z.string().min(1),
  risk: z.enum(['low', 'medium', 'high', 'critical']),
  mode: z.enum(['read-only', 'mutation']),
  spec: z.string().startsWith('e2e/'),
  status: z.string().min(1),
  notes: z.string().min(1),
  evidence: mutationEvidenceSchema.optional(),
}).superRefine((story, context) => {
  if (story.mode === 'mutation' && !story.evidence) {
    context.addIssue({ code: 'custom', message: 'Mutation stories require fixture and audit correlation evidence.' })
  }
})

const coverageSchema = z.object({ version: z.literal(1), stories: z.array(storySchema).min(1) })

export function validateE2eCoverage(value: unknown) {
  return coverageSchema.safeParse(value)
}

export function readE2eCoverage(path = 'e2e/coverage.json') {
  return validateE2eCoverage(JSON.parse(readFileSync(path, 'utf8')))
}

export function missingE2eCoverageSpecs(
  coverage: z.infer<typeof coverageSchema>,
  specExists: (path: string) => boolean = existsSync,
) {
  return coverage.stories.filter(story => !specExists(story.spec)).map(story => story.spec)
}
