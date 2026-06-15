import type { EvalContext } from '../types'
import { blockedByUniversal, capRateProjection, missingData, rentProjection, result } from './helpers'

export function evaluateBhLtr(ctx: EvalContext) {
  const universal = blockedByUniversal('BH_LTR', ctx)
  if (universal) return universal
  const missing = missingData('BH_LTR', ctx, ['improved', 'structureSqFt', 'bedroomCount'])
  if (missing) return missing
  const rent = ctx.parcel.comparableRent ?? ctx.jurisdiction.fmr(ctx.parcel.bedroomCount ?? 2)
  if (rent == null) return result('BH_LTR', 'INSUFFICIENT_DATA', [], ['Missing required data: fmr'])
  return result('BH_LTR', ctx.jurisdiction.rentControlZone ? 'CONDITIONAL' : 'VIABLE', [], [
    'Use 40% expense load for vacancy, management, maintenance, taxes, and insurance',
    ...(ctx.jurisdiction.rentControlZone ? ['Rent control zone requires local rule review'] : []),
  ], capRateProjection(ctx, rent * 12 * 0.6))
}

export function evaluateBhStr(ctx: EvalContext) {
  const universal = blockedByUniversal('BH_STR', ctx)
  if (universal) return universal
  const missing = missingData('BH_STR', ctx, ['improved', 'structureSqFt', 'bedroomCount'])
  if (missing) return missing
  if (ctx.jurisdiction.strAllowed === false) return result('BH_STR', 'NOT_VIABLE', ['Short-term rentals are not allowed'])
  return result('BH_STR', 'CONDITIONAL', [], ['Verify STR license availability, occupancy taxes, and platform restrictions'], rentProjection(ctx))
}

export function evaluateBhSection8(ctx: EvalContext) {
  const universal = blockedByUniversal('BH_SECTION8', ctx)
  if (universal) return universal
  const missing = missingData('BH_SECTION8', ctx, ['improved', 'structureSqFt', 'bedroomCount'])
  if (missing) return missing
  const fmr = ctx.jurisdiction.fmr(ctx.parcel.bedroomCount ?? 2)
  if (fmr == null) return result('BH_SECTION8', 'INSUFFICIENT_DATA', [], ['Missing required data: fmr'])
  return result('BH_SECTION8', 'VIABLE', [], ['Unit must pass HQS inspection; confirm local payment standard'], capRateProjection(ctx, fmr * 12 * 0.65))
}

export function evaluateBhSellToInvestor(ctx: EvalContext) {
  const universal = blockedByUniversal('BH_SELL_TO_INVESTOR', ctx)
  if (universal) return universal
  const missing = missingData('BH_SELL_TO_INVESTOR', ctx, ['improved', 'structureSqFt', 'noi'])
  if (missing) return missing
  return result('BH_SELL_TO_INVESTOR', 'VIABLE', [], ['Package rent roll, expenses, and cap-rate support for investor buyer'], capRateProjection(ctx))
}
