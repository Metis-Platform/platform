import { describe, expect, it } from 'vitest'
import { recentBuyerOutreach } from './wholesale-outreach'

describe('recentBuyerOutreach', () => {
  it('preserves only the linked buyer activity fields needed by the deal view', () => {
    expect(recentBuyerOutreach([{
      id: 'activity-1', type: 'CALL', notes: 'Buyer requested the packet.', occurredAt: new Date('2026-07-22T12:00:00.000Z'),
    }])).toEqual([{
      id: 'activity-1', type: 'CALL', notes: 'Buyer requested the packet.', occurredAt: '2026-07-22T12:00:00.000Z',
    }])
  })
})
