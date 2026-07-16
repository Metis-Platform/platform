import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/cron-guard', () => ({ guardCronRequest: vi.fn().mockReturnValue(null) }))

import { GET as govEase } from './sync-govease/route'
import { GET as realAuction } from './sync-realauction-fl/route'
import { GET as taxSaleResources } from './sync-tax-sale-resources/route'

describe('unimplemented auction feed routes', () => {
  it.each([
    ['GOVEASE', govEase],
    ['REALAUCTION_FL', realAuction],
    ['TAX_SALE_RESOURCES', taxSaleResources],
  ] as const)('returns an explicit disabled result for %s without a sync', async (source, handler) => {
    const response = await handler(new Request('https://metis.example/api/cron/test') as never)
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ skipped: true, source, reason: expect.stringContaining('not connected') })
  })
})
