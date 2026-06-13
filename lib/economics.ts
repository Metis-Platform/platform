import { TRANSACTION_DIRECTION } from '@/lib/transactions'

/**
 * A minimal ledger row shape for economics calculations.
 * Operates on plain data — no Prisma dependency — so functions are trivially testable.
 * In practice, FinancialTransaction rows from Prisma satisfy this shape.
 */
export interface LedgerRow {
  type: keyof typeof TRANSACTION_DIRECTION
  amount: number
  date: Date
}

/** Sum of all OUT-direction transaction amounts. */
export function costBasis(rows: LedgerRow[]): number {
  return rows
    .filter(r => TRANSACTION_DIRECTION[r.type] === 'OUT')
    .reduce((sum, r) => sum + r.amount, 0)
}

/** Sum of all IN-direction transaction amounts. */
export function incomeToDate(rows: LedgerRow[]): number {
  return rows
    .filter(r => TRANSACTION_DIRECTION[r.type] === 'IN')
    .reduce((sum, r) => sum + r.amount, 0)
}

/** Income minus cost basis (positive = profit, negative = loss). */
export function realizedPnl(rows: LedgerRow[]): number {
  return incomeToDate(rows) - costBasis(rows)
}

/**
 * Accrued interest on a tax lien using simple annualized interest.
 * Formula: faceAmount × annualRate × (days / 365)
 *
 * Note: annualRate is a decimal fraction (0.18 = 18%).
 * Jurisdiction-specific mechanics (bid-down, penalty, flat rate caps) are NOT
 * modelled here — those will come from #131 RuleSet data and are applied on top.
 *
 * Returns 0 if asOf is on or before issueDate (no negative accrual).
 */
export function accruedLienInterest(params: {
  faceAmount: number
  annualRate: number
  issueDate: Date
  asOf: Date
}): number {
  const { faceAmount, annualRate, issueDate, asOf } = params
  const days = Math.floor(
    (asOf.getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24)
  )
  if (days <= 0) return 0
  return faceAmount * annualRate * (days / 365)
}

/**
 * Annualized return: ((returned − invested) / invested) × (365 / days).
 * Returns null when invested is 0 (undefined division).
 * Uses max(days, 1) to prevent division by zero on same-day transactions.
 */
export function annualizedReturn(params: {
  invested: number
  returned: number
  startDate: Date
  endDate: Date
}): number | null {
  const { invested, returned, startDate, endDate } = params
  if (invested === 0) return null
  const days = Math.max(
    Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
    1
  )
  return ((returned - invested) / invested) * (365 / days)
}

/**
 * Unrealized value of a lien position: face amount plus accrued interest to date.
 * This is the amount the investor is owed if the owner redeems today.
 */
export function unrealizedLienValue(params: {
  faceAmount: number
  annualRate: number
  issueDate: Date
  asOf: Date
}): number {
  return params.faceAmount + accruedLienInterest(params)
}

// ---------------------------------------------------------------------------
// Fix & Flip economics
// ---------------------------------------------------------------------------

/** Fix & Flip P&L: sale price minus all costs. */
export function flipPnl(params: {
  salePrice: number
  purchasePrice: number
  rehabCost: number
  holdingCosts: number
}): number {
  const { salePrice, purchasePrice, rehabCost, holdingCosts } = params
  return salePrice - purchasePrice - rehabCost - holdingCosts
}

/**
 * Fix & Flip ROI as a decimal fraction: P&L / total invested.
 * Returns null when total invested is 0 (undefined division).
 */
export function flipRoi(params: {
  pnl: number
  purchasePrice: number
  rehabCost: number
  holdingCosts: number
}): number | null {
  const { pnl, purchasePrice, rehabCost, holdingCosts } = params
  const totalInvested = purchasePrice + rehabCost + holdingCosts
  if (totalInvested === 0) return null
  return pnl / totalInvested
}

/** Calendar days between two dates. Returns negative if endDate is before startDate. */
export function holdDays(startDate: Date, endDate: Date): number {
  return Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
}
