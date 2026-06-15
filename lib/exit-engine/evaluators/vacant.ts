import { projectNetProfit } from '../projections'
import type { EvalContext } from '../types'
import { blockedByUniversal, isFloodBuildRisk, minLotSize, missingData, purchasePrice, range, result } from './helpers'

function vacantBase(exitKey: 'VACANT_SELL_AS_IS' | 'VACANT_HOLD' | 'VACANT_WHOLESALE' | 'VACANT_DONATE', ctx: EvalContext) {
  const universal = blockedByUniversal(exitKey, ctx)
  if (universal) return universal
  const missing = missingData(exitKey, ctx, ['lotSizeSqFt', 'improved'])
  if (missing) return missing
  if (ctx.parcel.improved) return result(exitKey, 'NOT_VIABLE', ['Parcel is improved; use improved-property exits'])
  return null
}

function builderBlockers(ctx: EvalContext): string[] {
  const blockers: string[] = []
  const minLot = minLotSize(ctx)
  if (minLot != null && (ctx.parcel.lotSizeSqFt ?? 0) < minLot) blockers.push('Lot is smaller than jurisdiction minimum lot size')
  if (isFloodBuildRisk(ctx)) blockers.push('Flood zone plus wetlands creates buildability risk')
  if (ctx.parcel.roadFrontage === 'landlocked') blockers.push('Landlocked parcel lacks legal/physical road frontage')
  return blockers
}

export function evaluateVacantSellAsIs(ctx: EvalContext) {
  const base = vacantBase('VACANT_SELL_AS_IS', ctx)
  if (base) return base
  return result('VACANT_SELL_AS_IS', 'VIABLE', [], ['Price against raw land comps and disclose zoning/access gaps'])
}

export function evaluateVacantSellToBuilder(ctx: EvalContext) {
  const universal = blockedByUniversal('VACANT_SELL_TO_BUILDER', ctx)
  if (universal) return universal
  const missing = missingData('VACANT_SELL_TO_BUILDER', ctx, ['lotSizeSqFt', 'zoning', 'improved'])
  if (missing) return missing
  if (ctx.parcel.improved) return result('VACANT_SELL_TO_BUILDER', 'NOT_VIABLE', ['Parcel is already improved'])

  const blockers = builderBlockers(ctx)
  return result('VACANT_SELL_TO_BUILDER', blockers.length ? 'NOT_VIABLE' : 'VIABLE', blockers, [
    'Perc test if no sewer; survey boundaries before marketing to builders',
  ])
}

export function evaluateVacantBuildAndSell(ctx: EvalContext) {
  const universal = blockedByUniversal('VACANT_BUILD_AND_SELL', ctx)
  if (universal) return universal
  const missing = missingData('VACANT_BUILD_AND_SELL', ctx, ['lotSizeSqFt', 'zoning', 'improved'])
  if (missing) return missing
  const blockers = builderBlockers(ctx)
  const constructionMid = 225000
  if ((ctx.investor.improvementCapital ?? 0) < constructionMid) blockers.push('Investor improvement capital is below estimated construction cost')
  const verdict = blockers.length ? 'NOT_VIABLE' : ctx.investor.financing === 'LENDER' ? 'CONDITIONAL' : 'VIABLE'
  const projection = projectNetProfit({
    arv: ctx.parcel.arv ?? range(ctx.parcel.estimatedArv ?? 350000),
    purchasePrice: purchasePrice(ctx),
    rehabCost: range(constructionMid, 0.2),
    holdingCostPerMonth: 1500,
    holdMonths: 12,
  })
  return result('VACANT_BUILD_AND_SELL', verdict, blockers, ['Construction financing and permits require separate diligence'], projection)
}

export function evaluateVacantSubdivideAndSell(ctx: EvalContext) {
  const universal = blockedByUniversal('VACANT_SUBDIVIDE_AND_SELL', ctx)
  if (universal) return universal
  const missing = missingData('VACANT_SUBDIVIDE_AND_SELL', ctx, ['lotSizeSqFt', 'zoning', 'improved'])
  if (missing) return missing
  const minLot = minLotSize(ctx)
  const blockers = minLot != null && ctx.parcel.lotSizeSqFt! < minLot * 2
    ? ['Lot cannot produce two legal lots under current minimum lot size']
    : []
  return result('VACANT_SUBDIVIDE_AND_SELL', blockers.length ? 'NOT_VIABLE' : 'CONDITIONAL', blockers, [
    'Requires plat approval, survey, utility review, and 6-24 month hold tolerance',
  ])
}

export function evaluateVacantHold(ctx: EvalContext) {
  const base = vacantBase('VACANT_HOLD', ctx)
  if (base) return base
  return result('VACANT_HOLD', 'VIABLE', [], ['Confirm taxes, HOA, mowing, and nuisance carrying costs'])
}

export function evaluateVacantWholesale(ctx: EvalContext) {
  const base = vacantBase('VACANT_WHOLESALE', ctx)
  if (base) return base
  const conditions = ['Buyer list needed before contract']
  if (ctx.jurisdiction.wholesaleLicenseRequired && !(ctx.investor.licenseTypes?.includes('RE_LICENSE') ?? false)) {
    conditions.push('Wholesale license or real-estate license may be required')
  }
  return result('VACANT_WHOLESALE', conditions.length > 1 ? 'CONDITIONAL' : 'VIABLE', [], conditions)
}

export function evaluateVacantDonate(ctx: EvalContext) {
  const base = vacantBase('VACANT_DONATE', ctx)
  if (base) return base
  return result('VACANT_DONATE', 'CONDITIONAL', [], ['Confirm qualified recipient and appraisal/tax treatment'])
}
