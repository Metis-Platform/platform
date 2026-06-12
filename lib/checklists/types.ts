import type { TaskType, Priority, StrategyType } from '@/app/generated/prisma'

/**
 * Anchor fields that can exist on strategy-extension tables.
 * These correspond to actual DateTime? columns across DealTaxLien, DealTaxDeed, DealForeclosure.
 * Items whose anchor field is null on the deal record get no dueDate.
 */
export type DueAnchor =
  | 'auctionDate'
  | 'issueDate'
  | 'redemptionDeadline'
  | 'foreclosureEligibleDate'
  | 'saleDate'
  | 'purchaseDate'
  | 'optionExpiry'

/** One item in a checklist template. */
export interface ChecklistItem {
  /** Stable identifier — used for idempotency. Must be unique within the template. */
  key: string
  title: string
  description?: string
  taskType: TaskType
  defaultPriority: Priority
  /** Which date field on the strategy extension (or core Deal) to use as the due-date anchor. */
  dueAnchor?: DueAnchor
  /** Signed integer offset from the anchor date in calendar days. Negative = before anchor. */
  dueOffsetDays?: number
}

/** A complete checklist template for a strategy. */
export interface ChecklistTemplate {
  strategy: StrategyType
  label: string // human label, e.g. "Tax Lien Due Diligence"
  items: ChecklistItem[]
}
