import { projectNetProfit } from '../projections'
import type { EvalContext } from '../types'
import { blockedByUniversal, buildableEnvelope, isFloodBuildRisk, minLotSize, missingData, purchasePrice, range, result } from './helpers'

function vacantBase(exitKey: 'VACANT_SELL_AS_IS' | 'VACANT_HOLD' | 'VACANT_WHOLESALE' | 'VACANT_DONATE', ctx: EvalContext) {
  const universal = blockedByUniversal(exitKey, ctx)
  if (universal) return universal
  const missing = missingData(exitKey, ctx, ['lotSizeSqFt', 'improved'])
  if (missing) return missing
  if (ctx.parcel.improved) return result(exitKey, 'NOT_VIABLE', ['Parcel is improved; use improved-property exits'])
  return null
}

function builderAssessment(ctx: EvalContext) {
  const blockers: string[] = []
  const conditions: string[] = []
  const minLot = minLotSize(ctx)
  if (minLot != null && (ctx.parcel.lotSizeSqFt ?? 0) < minLot) blockers.push('Lot is smaller than jurisdiction minimum lot size')
  const minWidth = ctx.jurisdiction.minLotWidthFt?.(ctx.parcel.zoning)
  if (minWidth != null && ctx.parcel.frontageLinearFt != null && ctx.parcel.frontageLinearFt < minWidth) {
    blockers.push('Lot frontage is smaller than jurisdiction minimum width')
  }
  if (isFloodBuildRisk(ctx)) blockers.push('Flood zone plus wetlands creates buildability risk')
  if (ctx.parcel.roadFrontage === 'landlocked') blockers.push('Landlocked parcel lacks legal/physical road frontage')
  const envelope = buildableEnvelope(ctx)
  if (envelope && (envelope.widthFt === 0 || envelope.depthFt === 0)) {
    blockers.push('Jurisdiction setbacks leave no buildable envelope')
  }
  const envelopeCondition = envelope && envelope.widthFt > 0 && envelope.depthFt > 0
    ? `Standard setbacks leave an estimated ${envelope.widthFt} × ${envelope.depthFt} ft buildable envelope (${envelope.areaSqFt.toLocaleString()} sq ft); confirm the proposed structure can fit`
    : undefined
  if (blockers.some(blocker => blocker.includes('minimum')) && ctx.parcel.frontageLinearFt != null && ctx.parcel.lotDepthFt != null) {
    conditions.push('Confirm nonconforming-lot eligibility, survey boundaries, legal access, and utility/septic approval before treating standard dimensional failures as dispositive')
  }
  return { blockers, conditions, envelope, envelopeCondition }
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

  const assessment = builderAssessment(ctx)
  const setbackBlocksConstruction = assessment.blockers.includes('Jurisdiction setbacks leave no buildable envelope')
  return result('VACANT_SELL_TO_BUILDER', setbackBlocksConstruction ? 'NOT_VIABLE' : assessment.conditions.length ? 'CONDITIONAL' : assessment.blockers.length ? 'NOT_VIABLE' : 'VIABLE', assessment.blockers, [
    'Perc test if no sewer; survey boundaries before marketing to builders',
    ...assessment.conditions,
    ...(assessment.envelopeCondition ? [assessment.envelopeCondition] : []),
  ], undefined, assessment.envelope)
}

export function evaluateVacantBuildAndSell(ctx: EvalContext) {
  const universal = blockedByUniversal('VACANT_BUILD_AND_SELL', ctx)
  if (universal) return universal
  const missing = missingData('VACANT_BUILD_AND_SELL', ctx, ['lotSizeSqFt', 'zoning', 'improved'])
  if (missing) return missing
  const assessment = builderAssessment(ctx)
  const blockers = assessment.blockers
  const constructionMid = 225000
  if ((ctx.investor.improvementCapital ?? 0) < constructionMid) blockers.push('Investor improvement capital is below estimated construction cost')
  const setbackBlocksConstruction = blockers.includes('Jurisdiction setbacks leave no buildable envelope')
  const verdict = setbackBlocksConstruction
    ? 'NOT_VIABLE'
    : assessment.conditions.length || ctx.investor.financing === 'LENDER'
    ? 'CONDITIONAL'
    : blockers.length ? 'NOT_VIABLE' : 'VIABLE'
  const projection = projectNetProfit({
    arv: ctx.parcel.arv ?? range(ctx.parcel.estimatedArv ?? 350000),
    purchasePrice: purchasePrice(ctx),
    rehabCost: range(constructionMid, 0.2),
    holdingCostPerMonth: 1500,
    holdMonths: 12,
  })
  return result('VACANT_BUILD_AND_SELL', verdict, blockers, [
    'Construction financing and permits require separate diligence',
    ...assessment.conditions,
    ...(assessment.envelopeCondition ? [assessment.envelopeCondition] : []),
  ], projection, assessment.envelope)
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
