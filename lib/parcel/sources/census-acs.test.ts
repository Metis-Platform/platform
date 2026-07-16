import { describe, expect, it, vi } from 'vitest'
import { CENSUS_ACS_2024_SOURCE_URL, fetchDemographics } from './census-acs'

describe('fetchDemographics', () => {
  it('uses the current official 2024 ACS 5-year dataset and preserves area-level ratios', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify([
      ['B19013_001E', 'B25003_003E', 'B25003_001E', 'B25002_003E', 'B25002_001E'],
      ['80000', '20', '100', '10', '125'],
    ])))

    await expect(fetchDemographics('04013', '010100', fetchImpl)).resolves.toEqual({
      medianHouseholdIncome: 80_000, renterOccupancyPct: 0.2, vacancyRatePct: 0.08,
    })
    expect(fetchImpl).toHaveBeenCalledWith(expect.stringContaining(CENSUS_ACS_2024_SOURCE_URL), expect.any(Object))
  })

  it('returns a gap when the Census response has no estimate row', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify([['B19013_001E']])))
    await expect(fetchDemographics('04013', undefined, fetchImpl)).resolves.toEqual({})
  })
})
