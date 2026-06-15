import type { EvalContext } from '../types'
import { blockedByUniversal, capRateProjection, missingData, result } from './helpers'

function mfBase(exitKey: 'MF_HOLD_CASHFLOW' | 'MF_VALUE_ADD' | 'MF_CONDO_CONVERSION' | 'MF_SELL_TO_INVESTOR', ctx: EvalContext) {
  const universal = blockedByUniversal(exitKey, ctx)
  if (universal) return universal
  const missing = missingData(exitKey, ctx, ['improved', 'structureSqFt', 'noi'])
  if (missing) return missing
  if (!ctx.parcel.improved) return result(exitKey, 'NOT_VIABLE', ['Multifamily exits require improved property'])
  return null
}

export function evaluateMfHoldCashflow(ctx: EvalContext) {
  const base = mfBase('MF_HOLD_CASHFLOW', ctx)
  if (base) return base
  return result('MF_HOLD_CASHFLOW', 'VIABLE', [], ['Verify rent roll, trailing financials, and reserve assumptions'], capRateProjection(ctx))
}

export function evaluateMfValueAdd(ctx: EvalContext) {
  const base = mfBase('MF_VALUE_ADD', ctx)
  if (base) return base
  return result('MF_VALUE_ADD', 'CONDITIONAL', [], ['Validate renovation scope, tenant disruption risk, and post-renovation rents'], capRateProjection(ctx))
}

export function evaluateMfCondoConversion(ctx: EvalContext) {
  const base = mfBase('MF_CONDO_CONVERSION', ctx)
  if (base) return base
  const minLot = ctx.jurisdiction.minLotSizeSqFt(ctx.parcel.zoning)
  if (minLot != null && (ctx.parcel.lotSizeSqFt ?? 0) < minLot) {
    return result('MF_CONDO_CONVERSION', 'NOT_VIABLE', ['Lot appears too small for condo plat requirements'])
  }
  return result('MF_CONDO_CONVERSION', 'CONDITIONAL', [], ['Check state condo conversion law, tenant notices, and plat approval'])
}

export function evaluateMfSellToInvestor(ctx: EvalContext) {
  const base = mfBase('MF_SELL_TO_INVESTOR', ctx)
  if (base) return base
  return result('MF_SELL_TO_INVESTOR', 'VIABLE', [], ['Prepare T12, rent roll, and cap-rate support for investor sale'], capRateProjection(ctx))
}
