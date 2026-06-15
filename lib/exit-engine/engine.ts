import { scoreConfidence } from './confidence'
import type { ExitKey } from './keys'
import { EXIT_REGISTRY } from './registry'
import type { EvalContext, ExitResult, Verdict } from './types'

export const HARD_FIELDS: Record<ExitKey, string[]> = {
  LIEN_EARN_INTEREST: ['lienFaceValue'],
  LIEN_FORECLOSE_TO_DEED: ['lienFaceValue'],
  LIEN_ASSIGN_CERTIFICATE: ['lienFaceValue'],
  VACANT_SELL_AS_IS: ['lotSizeSqFt', 'improved'],
  VACANT_SELL_TO_BUILDER: ['lotSizeSqFt', 'zoning', 'improved'],
  VACANT_BUILD_AND_SELL: ['lotSizeSqFt', 'zoning', 'improved'],
  VACANT_SUBDIVIDE_AND_SELL: ['lotSizeSqFt', 'zoning', 'improved'],
  VACANT_HOLD: ['lotSizeSqFt', 'improved'],
  VACANT_WHOLESALE: ['lotSizeSqFt', 'improved'],
  VACANT_DONATE: ['lotSizeSqFt', 'improved'],
  IMPROVED_SELL_AS_IS: ['improved', 'structureSqFt'],
  IMPROVED_FLIP: ['improved', 'structureSqFt', 'arv'],
  IMPROVED_BUY_AND_HOLD: ['improved', 'structureSqFt', 'bedroomCount'],
  IMPROVED_WHOLESALE: ['improved', 'structureSqFt'],
  LAND_SELLER_FINANCE: ['lotSizeSqFt', 'improved'],
  LAND_TIMBER_AG: ['lotSizeSqFt', 'improved'],
  LAND_CONSERVATION_DONATION: ['lotSizeSqFt', 'improved'],
  WHOLESALE_ASSIGN: ['purchasePrice'],
  WHOLESALE_DOUBLE_CLOSE: ['purchasePrice'],
  FLIP_RENOVATE_AND_SELL: ['improved', 'structureSqFt', 'arv'],
  FLIP_PIVOT_TO_RENT: ['improved', 'structureSqFt', 'bedroomCount'],
  FLIP_SELL_MID_RENO: ['improved', 'structureSqFt'],
  BH_LTR: ['improved', 'structureSqFt', 'bedroomCount'],
  BH_STR: ['improved', 'structureSqFt', 'bedroomCount'],
  BH_SECTION8: ['improved', 'structureSqFt', 'bedroomCount'],
  BH_SELL_TO_INVESTOR: ['improved', 'structureSqFt', 'noi'],
  MF_HOLD_CASHFLOW: ['improved', 'structureSqFt', 'noi'],
  MF_VALUE_ADD: ['improved', 'structureSqFt', 'noi'],
  MF_CONDO_CONVERSION: ['improved', 'structureSqFt', 'noi'],
  MF_SELL_TO_INVESTOR: ['improved', 'structureSqFt', 'noi'],
}

export const SOFT_FIELDS: Record<ExitKey, string[]> = {
  LIEN_EARN_INTEREST: ['assessedValue'],
  LIEN_FORECLOSE_TO_DEED: ['assessedValue', 'arv'],
  LIEN_ASSIGN_CERTIFICATE: ['assessedValue'],
  VACANT_SELL_AS_IS: ['assessedValue'],
  VACANT_SELL_TO_BUILDER: ['assessedValue', 'zoning'],
  VACANT_BUILD_AND_SELL: ['assessedValue', 'arv'],
  VACANT_SUBDIVIDE_AND_SELL: ['assessedValue', 'arv'],
  VACANT_HOLD: ['assessedValue'],
  VACANT_WHOLESALE: ['assessedValue', 'purchasePrice'],
  VACANT_DONATE: ['assessedValue'],
  IMPROVED_SELL_AS_IS: ['assessedValue', 'arv'],
  IMPROVED_FLIP: ['rehabCost', 'assessedValue'],
  IMPROVED_BUY_AND_HOLD: ['comparableRent', 'assessedValue'],
  IMPROVED_WHOLESALE: ['arv', 'purchasePrice'],
  LAND_SELLER_FINANCE: ['assessedValue', 'purchasePrice'],
  LAND_TIMBER_AG: ['assessedValue', 'zoning'],
  LAND_CONSERVATION_DONATION: ['assessedValue', 'zoning'],
  WHOLESALE_ASSIGN: ['arv', 'rehabCost'],
  WHOLESALE_DOUBLE_CLOSE: ['arv', 'rehabCost'],
  FLIP_RENOVATE_AND_SELL: ['rehabCost', 'purchasePrice'],
  FLIP_PIVOT_TO_RENT: ['rehabCost', 'comparableRent'],
  FLIP_SELL_MID_RENO: ['arv', 'rehabCost'],
  BH_LTR: ['comparableRent', 'noi'],
  BH_STR: ['comparableRent', 'noi'],
  BH_SECTION8: ['comparableRent', 'noi'],
  BH_SELL_TO_INVESTOR: ['comparableRent', 'assessedValue'],
  MF_HOLD_CASHFLOW: ['comparableRent', 'purchasePrice'],
  MF_VALUE_ADD: ['rehabCost', 'purchasePrice'],
  MF_CONDO_CONVERSION: ['rehabCost', 'zoning'],
  MF_SELL_TO_INVESTOR: ['purchasePrice', 'assessedValue'],
}

const VERDICT_RANK: Record<Verdict, number> = {
  VIABLE: 0,
  CONDITIONAL: 1,
  INSUFFICIENT_DATA: 2,
  NOT_VIABLE: 3,
}

export function evaluateExits(ctx: EvalContext): ExitResult[] {
  return EXIT_REGISTRY
    .map(evaluator => {
      const base = evaluator.evaluate(ctx)

      if (base.verdict === 'INSUFFICIENT_DATA') {
        return { ...base, confidence: 0, dataGaps: [] }
      }

      const { score, gaps } = scoreConfidence({
        parcel: ctx.parcel,
        hardFields: HARD_FIELDS[evaluator.exitKey],
        softFields: SOFT_FIELDS[evaluator.exitKey],
      })
      const verdict = base.verdict === 'VIABLE' && score < 0.75 ? 'CONDITIONAL' : base.verdict

      return {
        ...base,
        verdict,
        confidence: score,
        dataGaps: gaps,
      }
    })
    .sort(byVerdictThenConfidence)
}

export function byVerdictThenConfidence(a: ExitResult, b: ExitResult): number {
  const rankDelta = VERDICT_RANK[a.verdict] - VERDICT_RANK[b.verdict]
  if (rankDelta !== 0) return rankDelta
  return b.confidence - a.confidence
}
