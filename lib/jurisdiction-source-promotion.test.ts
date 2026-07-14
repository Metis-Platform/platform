import { describe, expect, it } from 'vitest'
import { sourceDiscoveryPromotionSchema } from './jurisdiction-source-promotion'

describe('source discovery promotion input', () => {
  it('requires a concrete HTTP source and an optimistic-concurrency version', () => {
    expect(sourceDiscoveryPromotionSchema.safeParse({
      sourceUrl: 'https://official.example.gov/assessor', expectedUpdatedAt: '2026-07-14T00:00:00.000Z',
    }).success).toBe(true)
    expect(sourceDiscoveryPromotionSchema.safeParse({ sourceUrl: 'ftp://example.gov', expectedUpdatedAt: 'invalid' }).success).toBe(false)
  })
})
