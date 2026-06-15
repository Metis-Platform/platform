import type { EvalContext } from '../types'
import { arvRange, blockedByUniversal, flipProjection, missingData, result } from './helpers'

export function evaluateFlipRenovateAndSell(ctx: EvalContext) {
  const universal = blockedByUniversal('FLIP_RENOVATE_AND_SELL', ctx)
  if (universal) return universal
  const missing = missingData('FLIP_RENOVATE_AND_SELL', ctx, ['improved', 'structureSqFt', 'arv'])
  if (missing) return missing
  if (!ctx.parcel.improved) return result('FLIP_RENOVATE_AND_SELL', 'NOT_VIABLE', ['Parcel is vacant; use vacant build-and-sell'])

  const conditions = ['Verify title insurance availability and pull permit history']
  let verdict: 'VIABLE' | 'CONDITIONAL' = 'VIABLE'
  if (ctx.parcel.deedQuality === 'uninsurable') {
    verdict = 'CONDITIONAL'
    conditions.push('Uninsurable deed quality must be cured before resale to financed buyer')
  }

  return result('FLIP_RENOVATE_AND_SELL', verdict, [], conditions, flipProjection(ctx))
}

export function evaluateFlipPivotToRent(ctx: EvalContext) {
  const universal = blockedByUniversal('FLIP_PIVOT_TO_RENT', ctx)
  if (universal) return universal
  const missing = missingData('FLIP_PIVOT_TO_RENT', ctx, ['improved', 'structureSqFt', 'bedroomCount'])
  if (missing) return missing
  return result('FLIP_PIVOT_TO_RENT', 'CONDITIONAL', [], ['Verify long-term rent covers debt service before abandoning sale'])
}

export function evaluateFlipSellMidReno(ctx: EvalContext) {
  const universal = blockedByUniversal('FLIP_SELL_MID_RENO', ctx)
  if (universal) return universal
  const missing = missingData('FLIP_SELL_MID_RENO', ctx, ['improved', 'structureSqFt'])
  if (missing) return missing
  const verdict = (ctx.investor.holdMonthsTolerance ?? 12) < 6 ? 'VIABLE' : 'CONDITIONAL'
  const projection = flipProjection(ctx)
  const discounted = projection
    ? { ...projection, low: projection.low * 0.75, mid: projection.mid * 0.75, high: projection.high * 0.75, basis: `${projection.basis}; discounted for mid-renovation sale` }
    : undefined
  return result('FLIP_SELL_MID_RENO', verdict, [], ['Discount expected for buyer taking construction risk'], discounted)
}

export function hasFlipArv(ctx: EvalContext): boolean {
  return arvRange(ctx) != null
}
