// Shared metadata for all StrategyType enum values.
// Uses a type-only Prisma import so client components do not pull Prisma runtime code.

import type { StrategyType } from '@/app/generated/prisma'

export type StrategyKey = StrategyType

export type StrategyMeta = {
  key: StrategyKey
  /** Singular display name, e.g. "Tax Lien" */
  label: string
  /** Plural display name, e.g. "Tax Liens" */
  plural: string
  /** Nav tab label */
  navLabel: string
  /** "+ New …" button text */
  newLabel: string
  /** Page heading for new-deal page */
  newTitle: string
  /** Sub-heading for new-deal page */
  newSubtitle: string
  emptyText: string
  searchPlaceholder: string
  /** Column header for the primary date field */
  dateCol: string
  /** Column header for the primary amount field */
  amountCol: string
  /** Column header for the reference/cert number field */
  refCol: string
  /** Whether the create flow exists in the UI */
  creatable: boolean
}

const ALL: StrategyMeta[] = [
  {
    key: 'TAX_LIEN',
    label: 'Tax Lien',
    plural: 'Tax Liens',
    navLabel: 'Tax Liens',
    newLabel: '+ New Lien',
    newTitle: 'New Tax Lien',
    newSubtitle: 'Deadlines are calculated automatically from the issue date and jurisdiction rules.',
    emptyText: 'No liens match your filters.',
    searchPlaceholder: 'Search APN, cert #, address…',
    dateCol: 'Issue Date',
    amountCol: 'Face Amount',
    refCol: 'Certificate #',
    creatable: true,
  },
  {
    key: 'TAX_DEED',
    label: 'Tax Deed',
    plural: 'Tax Deeds',
    navLabel: 'Tax Deeds',
    newLabel: '+ New Deed',
    newTitle: 'New Tax Deed',
    newSubtitle: 'Track a tax deed purchase. Deadlines are calculated from the sale date and jurisdiction rules.',
    emptyText: 'No deeds match your filters.',
    searchPlaceholder: 'Search APN, address…',
    dateCol: 'Sale Date',
    amountCol: 'Winning Bid',
    refCol: 'Deed #',
    creatable: true,
  },
  {
    key: 'FORECLOSURE',
    label: 'Foreclosure',
    plural: 'Foreclosures',
    navLabel: 'Foreclosures',
    newLabel: '+ New Foreclosure',
    newTitle: 'New Foreclosure',
    newSubtitle: 'Track a foreclosure auction bid. Log pre-foreclosure leads or record a winning bid.',
    emptyText: 'No foreclosures match your filters.',
    searchPlaceholder: 'Search APN, address…',
    dateCol: 'Auction Date',
    amountCol: 'Winning Bid',
    refCol: 'Type',
    creatable: true,
  },
  {
    key: 'FIX_FLIP',
    label: 'Fix & Flip',
    plural: 'Fix & Flips',
    navLabel: 'Fix & Flip',
    newLabel: '+ New Flip',
    newTitle: 'New Fix & Flip',
    newSubtitle: 'Fix & Flip deal creation is coming soon.',
    emptyText: 'No fix & flip deals match your filters.',
    searchPlaceholder: 'Search APN, address…',
    dateCol: 'Rehab Start',
    amountCol: 'ARV',
    refCol: 'Rehab Budget',
    creatable: false,
  },
  {
    key: 'WHOLESALE',
    label: 'Wholesale',
    plural: 'Wholesale Deals',
    navLabel: 'Wholesale',
    newLabel: '+ New Deal',
    newTitle: 'New Wholesale Deal',
    newSubtitle: 'Wholesale deal creation is coming soon.',
    emptyText: 'No wholesale deals match your filters.',
    searchPlaceholder: 'Search APN, address…',
    dateCol: 'Contract Date',
    amountCol: 'Contract Price',
    refCol: 'Assignment Fee',
    creatable: false,
  },
  {
    key: 'BUY_HOLD',
    label: 'Buy & Hold',
    plural: 'Buy & Hold',
    navLabel: 'Buy & Hold',
    newLabel: '+ New Property',
    newTitle: 'New Buy & Hold',
    newSubtitle: 'Buy & Hold deal creation is coming soon.',
    emptyText: 'No buy & hold properties match your filters.',
    searchPlaceholder: 'Search APN, address…',
    dateCol: 'Lease Start',
    amountCol: 'Monthly Rent',
    refCol: 'Rental Strategy',
    creatable: false,
  },
  {
    key: 'LAND',
    label: 'Land',
    plural: 'Land Deals',
    navLabel: 'Land',
    newLabel: '+ New Parcel',
    newTitle: 'New Land Deal',
    newSubtitle: 'Land deal creation is coming soon.',
    emptyText: 'No land deals match your filters.',
    searchPlaceholder: 'Search APN, address…',
    dateCol: 'Option Expiry',
    amountCol: 'Purchase Price',
    refCol: 'Acres / Access',
    creatable: false,
  },
  {
    key: 'MULTIFAMILY',
    label: 'Multifamily',
    plural: 'Multifamily',
    navLabel: 'Multifamily',
    newLabel: '+ New Property',
    newTitle: 'New Multifamily',
    newSubtitle: 'Multifamily deal creation is coming soon.',
    emptyText: 'No multifamily properties match your filters.',
    searchPlaceholder: 'Search APN, address…',
    dateCol: 'Purchase Date',
    amountCol: 'NOI',
    refCol: 'Units',
    creatable: false,
  },
]

export const STRATEGY_META: Record<StrategyKey, StrategyMeta> =
  Object.fromEntries(ALL.map(m => [m.key, m])) as Record<StrategyKey, StrategyMeta>

/** Ordered list of all strategies, used for nav tabs. */
export const ALL_STRATEGIES: readonly StrategyMeta[] = ALL

/** Strategy keys that have a working create flow. */
export const CREATABLE_STRATEGIES: ReadonlySet<StrategyKey> = new Set(
  ALL.filter(strategy => strategy.creatable).map(strategy => strategy.key),
)

/**
 * Parse a URL ?strategy= param into a validated StrategyKey.
 * Defaults to TAX_LIEN for unknown or missing values.
 */
export function parseStrategyParam(param: string | undefined): StrategyKey {
  if (param && param in STRATEGY_META) return param as StrategyKey
  return 'TAX_LIEN'
}

/**
 * Like parseStrategyParam, but absent/unknown values mean "no strategy
 * selected" (the cross-strategy portfolio view) instead of TAX_LIEN.
 */
export function parseOptionalStrategyParam(param: string | undefined): StrategyKey | null {
  if (param && param in STRATEGY_META) return param as StrategyKey
  return null
}

/** Get metadata for a strategy key, falling back to TAX_LIEN. */
export function getStrategyMeta(key: string): StrategyMeta {
  return STRATEGY_META[key as StrategyKey] ?? STRATEGY_META.TAX_LIEN
}
