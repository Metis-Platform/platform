import type { Projection } from './types'

interface Range {
  low: number
  mid: number
  high: number
}

function projection(params: Omit<Projection, 'currency'>): Projection {
  return { ...params, currency: 'USD' }
}

export function projectNetProfit(params: {
  arv: Range
  purchasePrice: number
  rehabCost?: Range
  closingCostPct?: number
  holdingCostPerMonth?: number
  holdMonths?: number
}): Projection {
  const closingCostPct = params.closingCostPct ?? 0.06
  const holdingCost = (params.holdingCostPerMonth ?? 0) * (params.holdMonths ?? 0)
  const rehabCost = params.rehabCost ?? { low: 0, mid: 0, high: 0 }

  return projection({
    low: params.arv.low - params.purchasePrice - rehabCost.high - params.arv.low * closingCostPct - holdingCost,
    mid: params.arv.mid - params.purchasePrice - rehabCost.mid - params.arv.mid * closingCostPct - holdingCost,
    high: params.arv.high - params.purchasePrice - rehabCost.low - params.arv.high * closingCostPct - holdingCost,
    basis: 'ARV range less purchase price, costs, and hold assumptions',
    assumptions: [
      `Closing costs at ${(closingCostPct * 100).toFixed(1)}% of resale value`,
      `Holding cost ${params.holdingCostPerMonth ?? 0}/month for ${params.holdMonths ?? 0} months`,
    ],
    metric: 'net_profit',
  })
}

export function projectMonthlyRent(params: {
  fmr?: number
  comparableRent?: number
  bedroomCount?: number
  propertyClass?: 'A' | 'B' | 'C'
}): Projection {
  const baseRent = params.comparableRent ?? params.fmr ?? 0
  const classMultiplier = params.propertyClass === 'A' ? 1.1 : params.propertyClass === 'C' ? 0.9 : 1
  const adjustedRent = baseRent * classMultiplier

  return projection({
    low: adjustedRent * 0.9,
    mid: adjustedRent,
    high: adjustedRent * 1.1,
    basis: params.comparableRent ? 'Comparable rent estimate' : 'Fair market rent estimate',
    assumptions: [
      `${params.bedroomCount ?? 0} bedroom count used when available`,
      `Property class ${params.propertyClass ?? 'B'} rent multiplier`,
    ],
    metric: 'monthly_cashflow',
  })
}

export function projectCapRate(params: {
  noi: Projection
  purchasePrice: number
}): Projection {
  const divisor = params.purchasePrice > 0 ? params.purchasePrice : 1

  return projection({
    low: params.noi.low / divisor,
    mid: params.noi.mid / divisor,
    high: params.noi.high / divisor,
    basis: `NOI projection divided by purchase price ${params.purchasePrice}`,
    assumptions: [...params.noi.assumptions],
    metric: 'roi',
  })
}

export function projectLienReturn(params: {
  faceValue: number
  interestRate: number
  holdMonths: number
  redemptionProbability?: number
}): Projection {
  const probability = params.redemptionProbability ?? 1
  const expectedInterest = params.faceValue * params.interestRate * (params.holdMonths / 12) * probability
  const roi = params.faceValue > 0 ? expectedInterest / params.faceValue : 0

  return projection({
    low: roi * 0.8,
    mid: roi,
    high: roi * 1.2,
    basis: 'Simple lien interest return adjusted for redemption probability',
    assumptions: [
      `${(params.interestRate * 100).toFixed(1)}% annual interest rate`,
      `${params.holdMonths} month hold`,
      `${(probability * 100).toFixed(1)}% redemption probability`,
    ],
    metric: 'roi',
  })
}
