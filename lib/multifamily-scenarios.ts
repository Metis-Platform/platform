export type ScenarioInputs = {
  baseNOI: number        // annual NOI at acquisition
  purchasePrice: number  // total cost basis
  loanAmount: number     // loan at acquisition
  annualDebtService: number // annual debt service
}

export type ScenarioResult = {
  holdYears: number
  noigrowthPct: number   // annual NOI growth rate applied
  exitCapRate: number
  exitNOI: number
  exitValue: number
  equityAtExit: number   // exit value - remaining loan (approx)
  totalCashFlow: number  // approx cumulative cash flow over hold
  initialEquity: number
  equityMultiple: number | null
}

export const DEFAULT_CAP_RATES = [0.05, 0.06, 0.07, 0.08, 0.09]
export const DEFAULT_HOLD_YEARS = [3, 5, 7, 10]
export const DEFAULT_NOI_GROWTH  = 0.03 // 3% annual

export function computeScenario(
  inputs: ScenarioInputs,
  holdYears: number,
  exitCapRate: number,
  noiGrowthPct = DEFAULT_NOI_GROWTH,
): ScenarioResult {
  const { baseNOI, purchasePrice, loanAmount, annualDebtService } = inputs

  const initialEquity = Math.max(purchasePrice - loanAmount, 0)
  const exitNOI   = baseNOI * Math.pow(1 + noiGrowthPct, holdYears)
  const exitValue = exitNOI / exitCapRate
  // Simplified: assume interest-only or balloon (remaining loan ≈ loanAmount)
  const equityAtExit   = exitValue - loanAmount
  const annualCashFlow = baseNOI - annualDebtService
  const totalCashFlow  = annualCashFlow * holdYears

  const totalReturn = equityAtExit + totalCashFlow
  const equityMultiple = initialEquity > 0 ? totalReturn / initialEquity : null

  return { holdYears, noigrowthPct: noiGrowthPct, exitCapRate, exitNOI, exitValue, equityAtExit, totalCashFlow, initialEquity, equityMultiple }
}

export function computeGrid(
  inputs: ScenarioInputs,
  exitCapRates: number[] = DEFAULT_CAP_RATES,
  holdYearsOptions: number[] = DEFAULT_HOLD_YEARS,
  noiGrowthPct = DEFAULT_NOI_GROWTH,
): ScenarioResult[][] {
  return exitCapRates.map(cap =>
    holdYearsOptions.map(hold => computeScenario(inputs, hold, cap, noiGrowthPct))
  )
}
