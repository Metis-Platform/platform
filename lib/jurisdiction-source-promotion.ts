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
