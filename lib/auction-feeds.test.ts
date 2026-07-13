import { describe, expect, it } from 'vitest'
import { createTaxSaleEvents, upsertAuctionSales } from './auction-feeds'

const resetSafeEnvironment = {
  APP_ENV: 'integration',
  INTEGRATION_AUCTION_MODE: 'disabled',
}

describe('auction feed integration safety', () => {
  it('blocks feed upserts before database access', async () => {
    await expect(upsertAuctionSales([], resetSafeEnvironment)).rejects.toThrow(
      'auction is blocked by the environment side-effect policy'
    )
  })

  it('blocks event creation before database access', async () => {
    await expect(
      createTaxSaleEvents(
        'jurisdiction-id',
        new Date('2026-07-13T00:00:00.000Z'),
        'Tax Sale',
        undefined,
        resetSafeEnvironment
      )
    ).rejects.toThrow('auction is blocked by the environment side-effect policy')
  })
})
