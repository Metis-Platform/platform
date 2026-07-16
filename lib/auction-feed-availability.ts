export const DISABLED_AUCTION_FEEDS = {
  GOVEASE: 'GovEase is not connected; no auction calendar data is being imported.',
  REALAUCTION_FL: 'RealAuction FL is not connected; no auction calendar data is being imported.',
  TAX_SALE_RESOURCES: 'Tax Sale Resources is not connected; no auction calendar data is being imported.',
} as const

export type DisabledAuctionFeed = keyof typeof DISABLED_AUCTION_FEEDS

export function disabledAuctionFeedResult(source: DisabledAuctionFeed) {
  return { skipped: true, source, reason: DISABLED_AUCTION_FEEDS[source] }
}
