import type { EvalContext } from '../types'
import { capRateProjection, missingData, rentProjection, result, blockedByUniversal, flipProjection } from './helpers'
import { evaluateFlipRenovateAndSell } from './flip'

export function evaluateImprovedSellAsIs(ctx: EvalContext) {
  const universal = blockedByUniversal('IMPROVED_SELL_AS_IS', ctx)
  if (universal) return universal
  const missing = missingData('IMPROVED_SELL_AS_IS', ctx, ['improved', 'structureSqFt'])
  if (missing) return missing
  if (!ctx.parcel.improved) return result('IMPROVED_SELL_AS_IS', 'NOT_VIABLE', ['Parcel is not improved'])
  return result('IMPROVED_SELL_AS_IS', 'VIABLE', [], ['Price against as-is comps and disclose condition/title issues'])
}

export function evaluateImprovedFlip(ctx: EvalContext) {
  const flip = evaluateFlipRenovateAndSell(ctx)
  return { ...flip, exitKey: 'IMPROVED_FLIP' as const, projection: flip.projection ?? flipProjection(ctx) }
}

export function evaluateImprovedBuyAndHold(ctx: EvalContext) {
  const universal = blockedByUniversal('IMPROVED_BUY_AND_HOLD', ctx)
  if (universal) return universal
  const missing = missingData('IMPROVED_BUY_AND_HOLD', ctx, ['improved', 'structureSqFt', 'bedroomCount'])
  if (missing) return missing
  if (!ctx.parcel.improved) return result('IMPROVED_BUY_AND_HOLD', 'NOT_VIABLE', ['Parcel is not improved'])
  return result('IMPROVED_BUY_AND_HOLD', 'VIABLE', [], ['Verify rent-ready condition and property management assumptions'], rentProjection(ctx))
}

export function evaluateImprovedWholesale(ctx: EvalContext) {
  const universal = blockedByUniversal('IMPROVED_WHOLESALE', ctx)
  if (universal) return universal
  const missing = missingData('IMPROVED_WHOLESALE', ctx, ['improved', 'structureSqFt'])
  if (missing) return missing
  if (!ctx.parcel.improved) return result('IMPROVED_WHOLESALE', 'NOT_VIABLE', ['Parcel is not improved'])
  return result('IMPROVED_WHOLESALE', 'VIABLE', [], ['Confirm assignment legality and buyer appetite'], capRateProjection(ctx))
}
