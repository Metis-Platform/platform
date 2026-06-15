import type { EvalContext } from '../types'
import { blockedByUniversal, missingData, result } from './helpers'

function landBase(exitKey: 'LAND_SELLER_FINANCE' | 'LAND_TIMBER_AG' | 'LAND_CONSERVATION_DONATION', ctx: EvalContext) {
  const universal = blockedByUniversal(exitKey, ctx)
  if (universal) return universal
  const missing = missingData(exitKey, ctx, ['lotSizeSqFt', 'improved'])
  if (missing) return missing
  if (ctx.parcel.improved) return result(exitKey, 'NOT_VIABLE', ['Land exit assumes an unimproved parcel'])
  return null
}

export function evaluateLandSellerFinance(ctx: EvalContext) {
  const base = landBase('LAND_SELLER_FINANCE', ctx)
  if (base) return base
  return result('LAND_SELLER_FINANCE', 'VIABLE', [], ['Verify legal access, title, and buyer underwriting before offering terms'])
}

export function evaluateLandTimberAg(ctx: EvalContext) {
  const base = landBase('LAND_TIMBER_AG', ctx)
  if (base) return base
  return result('LAND_TIMBER_AG', 'CONDITIONAL', [], ['Confirm zoning, soil, timber/ag classification, and rollback tax exposure'])
}

export function evaluateLandConservationDonation(ctx: EvalContext) {
  const base = landBase('LAND_CONSERVATION_DONATION', ctx)
  if (base) return base
  return result('LAND_CONSERVATION_DONATION', 'CONDITIONAL', [], ['Requires qualified conservation purpose, appraisal, and tax counsel'])
}
