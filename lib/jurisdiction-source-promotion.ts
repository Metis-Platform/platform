import { z } from 'zod'

const externalHttpUrl = z.string().url().max(2000).refine(value => {
  const protocol = new URL(value).protocol
  return protocol === 'https:' || protocol === 'http:'
})

export const sourceDiscoveryPromotionSchema = z.object({
  sourceUrl: externalHttpUrl,
  expectedUpdatedAt: z.string().datetime().transform(value => new Date(value)),
})

export type SourceDiscoveryPromotionInput = z.output<typeof sourceDiscoveryPromotionSchema>

export function requiresReplacementSourceUrl(input: {
  candidateScope: 'DISCOVERY_ENTRYPOINT' | 'COUNTY_OFFICE_CANDIDATE'
  leadUrl: string
  sourceUrl: string
}) {
  if (input.candidateScope !== 'DISCOVERY_ENTRYPOINT') return false
  return canonicalSourceUrl(input.leadUrl) === canonicalSourceUrl(input.sourceUrl)
}

function canonicalSourceUrl(value: string) {
  const url = new URL(value)
  url.hash = ''
  return url.toString()
}
