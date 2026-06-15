import type { EvalContext } from '../types'
import { blockedByUniversal, hasWholesaleLicense, missingData, result } from './helpers'

export function evaluateWholesaleAssign(ctx: EvalContext) {
  const universal = blockedByUniversal('WHOLESALE_ASSIGN', ctx)
  if (universal) return universal
  const missing = missingData('WHOLESALE_ASSIGN', ctx, ['purchasePrice'])
  if (missing) return missing
  const conditions = ['Assignment fee typically 5-15% of purchase price; verify buyer list before contracting']
  if (ctx.jurisdiction.wholesaleLicenseRequired && !hasWholesaleLicense(ctx)) {
    conditions.push('Jurisdiction may require real-estate license for assignment')
  }
  return result('WHOLESALE_ASSIGN', conditions.length > 1 ? 'CONDITIONAL' : 'VIABLE', [], conditions)
}

export function evaluateWholesaleDoubleClose(ctx: EvalContext) {
  const universal = blockedByUniversal('WHOLESALE_DOUBLE_CLOSE', ctx)
  if (universal) return universal
  const missing = missingData('WHOLESALE_DOUBLE_CLOSE', ctx, ['purchasePrice'])
  if (missing) return missing
  return result('WHOLESALE_DOUBLE_CLOSE', 'CONDITIONAL', [], [
    'Requires transactional funding and clean closing coordination',
    ctx.investor.financing === 'CASH' ? 'Cash buyer profile helps execution' : 'Lender financing may slow double close timing',
  ])
}
