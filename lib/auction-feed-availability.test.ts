import { describe, expect, it } from 'vitest'
import { disabledAuctionFeedResult } from './auction-feed-availability'

describe('disabled auction feed availability', () => {
  it('makes each unimplemented provider inspectably unavailable', () => {
    expect(disabledAuctionFeedResult('GOVEASE')).toEqual({
      skipped: true, source: 'GOVEASE',
      reason: 'GovEase is not connected; no auction calendar data is being imported.',
    })
  })
})
