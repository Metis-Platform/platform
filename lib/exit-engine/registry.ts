import type { ExitEvaluator } from './types'
import { evaluateBhLtr, evaluateBhSection8, evaluateBhSellToInvestor, evaluateBhStr } from './evaluators/buy-hold'
import { evaluateFlipPivotToRent, evaluateFlipRenovateAndSell, evaluateFlipSellMidReno } from './evaluators/flip'
import { evaluateImprovedBuyAndHold, evaluateImprovedFlip, evaluateImprovedSellAsIs, evaluateImprovedWholesale } from './evaluators/improved'
import { evaluateLandConservationDonation, evaluateLandSellerFinance, evaluateLandTimberAg } from './evaluators/land'
import { evaluateLienAssignCertificate, evaluateLienEarnInterest, evaluateLienForecloseToDeed } from './evaluators/lien'
import { evaluateMfCondoConversion, evaluateMfHoldCashflow, evaluateMfSellToInvestor, evaluateMfValueAdd } from './evaluators/multifamily'
import { evaluateVacantBuildAndSell, evaluateVacantDonate, evaluateVacantHold, evaluateVacantSellAsIs, evaluateVacantSellToBuilder, evaluateVacantSubdivideAndSell, evaluateVacantWholesale } from './evaluators/vacant'
import { evaluateWholesaleAssign, evaluateWholesaleDoubleClose } from './evaluators/wholesale'

export const EXIT_REGISTRY: ExitEvaluator[] = [
  { exitKey: 'LIEN_EARN_INTEREST', evaluate: evaluateLienEarnInterest },
  { exitKey: 'LIEN_FORECLOSE_TO_DEED', evaluate: evaluateLienForecloseToDeed },
  { exitKey: 'LIEN_ASSIGN_CERTIFICATE', evaluate: evaluateLienAssignCertificate },
  { exitKey: 'VACANT_SELL_AS_IS', evaluate: evaluateVacantSellAsIs },
  { exitKey: 'VACANT_SELL_TO_BUILDER', evaluate: evaluateVacantSellToBuilder },
  { exitKey: 'VACANT_BUILD_AND_SELL', evaluate: evaluateVacantBuildAndSell },
  { exitKey: 'VACANT_SUBDIVIDE_AND_SELL', evaluate: evaluateVacantSubdivideAndSell },
  { exitKey: 'VACANT_HOLD', evaluate: evaluateVacantHold },
  { exitKey: 'VACANT_WHOLESALE', evaluate: evaluateVacantWholesale },
  { exitKey: 'VACANT_DONATE', evaluate: evaluateVacantDonate },
  { exitKey: 'IMPROVED_SELL_AS_IS', evaluate: evaluateImprovedSellAsIs },
  { exitKey: 'IMPROVED_FLIP', evaluate: evaluateImprovedFlip },
  { exitKey: 'IMPROVED_BUY_AND_HOLD', evaluate: evaluateImprovedBuyAndHold },
  { exitKey: 'IMPROVED_WHOLESALE', evaluate: evaluateImprovedWholesale },
  { exitKey: 'LAND_SELLER_FINANCE', evaluate: evaluateLandSellerFinance },
  { exitKey: 'LAND_TIMBER_AG', evaluate: evaluateLandTimberAg },
  { exitKey: 'LAND_CONSERVATION_DONATION', evaluate: evaluateLandConservationDonation },
  { exitKey: 'WHOLESALE_ASSIGN', evaluate: evaluateWholesaleAssign },
  { exitKey: 'WHOLESALE_DOUBLE_CLOSE', evaluate: evaluateWholesaleDoubleClose },
  { exitKey: 'FLIP_RENOVATE_AND_SELL', evaluate: evaluateFlipRenovateAndSell },
  { exitKey: 'FLIP_PIVOT_TO_RENT', evaluate: evaluateFlipPivotToRent },
  { exitKey: 'FLIP_SELL_MID_RENO', evaluate: evaluateFlipSellMidReno },
  { exitKey: 'BH_LTR', evaluate: evaluateBhLtr },
  { exitKey: 'BH_STR', evaluate: evaluateBhStr },
  { exitKey: 'BH_SECTION8', evaluate: evaluateBhSection8 },
  { exitKey: 'BH_SELL_TO_INVESTOR', evaluate: evaluateBhSellToInvestor },
  { exitKey: 'MF_HOLD_CASHFLOW', evaluate: evaluateMfHoldCashflow },
  { exitKey: 'MF_VALUE_ADD', evaluate: evaluateMfValueAdd },
  { exitKey: 'MF_CONDO_CONVERSION', evaluate: evaluateMfCondoConversion },
  { exitKey: 'MF_SELL_TO_INVESTOR', evaluate: evaluateMfSellToInvestor },
]
