export type BuyerOutreachActivity = {
  id: string
  type: string
  notes: string | null
  occurredAt: Date
}

export type BuyerOutreachRow = Omit<BuyerOutreachActivity, 'occurredAt'> & { occurredAt: string }

export function recentBuyerOutreach(activities: BuyerOutreachActivity[]): BuyerOutreachRow[] {
  return activities.map(activity => ({ ...activity, occurredAt: activity.occurredAt.toISOString() }))
}
