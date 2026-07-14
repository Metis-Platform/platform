import { describe, expect, it } from 'vitest'
import { requiresReplacementSourceUrl, sourceDiscoveryPromotionSchema } from './jurisdiction-source-promotion'

describe('source discovery promotion input', () => {
  it('requires a concrete HTTP source and an optimistic-concurrency version', () => {
    expect(sourceDiscoveryPromotionSchema.safeParse({
      sourceUrl: 'https://official.example.gov/assessor', expectedUpdatedAt: '2026-07-14T00:00:00.000Z',
    }).success).toBe(true)
    expect(sourceDiscoveryPromotionSchema.safeParse({ sourceUrl: 'ftp://example.gov', expectedUpdatedAt: 'invalid' }).success).toBe(false)
  })

  it('requires a different concrete URL when promoting a discovery entry point', () => {
    expect(requiresReplacementSourceUrl({
      candidateScope: 'DISCOVERY_ENTRYPOINT',
      leadUrl: 'https://directory.example.gov/',
      sourceUrl: 'https://directory.example.gov/#assessor',
    })).toBe(true)
    expect(requiresReplacementSourceUrl({
      candidateScope: 'DISCOVERY_ENTRYPOINT',
      leadUrl: 'https://directory.example.gov/',
      sourceUrl: 'https://county.example.gov/assessor',
    })).toBe(false)
    expect(requiresReplacementSourceUrl({
      candidateScope: 'COUNTY_OFFICE_CANDIDATE',
      leadUrl: 'https://county.example.gov/assessor',
      sourceUrl: 'https://county.example.gov/assessor',
    })).toBe(false)
  })
})
