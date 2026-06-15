// Pure waterfall computation — no Prisma imports

export type WaterfallParams = {
  preferredReturnRate: number // annual, e.g. 0.08
  lpSplit: number             // equity share above pref, e.g. 0.80
  gpSplit: number             // e.g. 0.20
  promoteHurdle?: number | null  // IRR hurdle for GP promote, e.g. 0.12
  promoteCarry?: number | null   // GP carry above hurdle, e.g. 0.30
}

export type LpInvestor = {
  id: string
  name: string
  committedAmount: number
  fundedAmount: number
  equityPct: number | null // manual override; null = auto from funded/total
}

export type WaterfallDistribution = {
  lpId: string
  name: string
  equityPct: number
  prefEarned: number     // how much pref this LP has accrued
  prefPaid: number       // pref allocated from this distribution
  returnOfCapital: number
  equityProfit: number
  total: number
}

export type WaterfallResult = {
  totalDistribution: number
  prefPool: number
  rocPool: number
  equityPool: number
  gpCut: number
  lpCut: number
  lpDistributions: WaterfallDistribution[]
}

export function computeEquityPcts(investors: LpInvestor[]): Map<string, number> {
  const totalFunded = investors.reduce((s, i) => s + i.fundedAmount, 0)
  const map = new Map<string, number>()
  for (const inv of investors) {
    if (inv.equityPct != null) {
      map.set(inv.id, inv.equityPct)
    } else {
      map.set(inv.id, totalFunded > 0 ? inv.fundedAmount / totalFunded : 0)
    }
  }
  return map
}

/**
 * Simple 3-tier waterfall for a single distribution event.
 * Assumes all pref has been fully earned (no IRR tracking — uses simple rate * capital * years).
 * `holdYears` is the time since the raise (for pref calculation).
 */
export function computeWaterfallDistribution(
  distribution: number,
  investors: LpInvestor[],
  params: WaterfallParams,
  holdYears: number,
): WaterfallResult {
  if (investors.length === 0 || distribution <= 0) {
    return {
      totalDistribution: distribution,
      prefPool: 0,
      rocPool: 0,
      equityPool: 0,
      gpCut: 0,
      lpCut: 0,
      lpDistributions: [],
    }
  }

  const equityPcts = computeEquityPcts(investors)
  let remaining = distribution

  // 1. Preferred return pool (simple, not compounded)
  const totalFunded = investors.reduce((s, i) => s + i.fundedAmount, 0)
  const totalPref = totalFunded * params.preferredReturnRate * holdYears
  const prefPool = Math.min(remaining, totalPref)
  remaining -= prefPool

  // 2. Return of capital pool
  const rocPool = Math.min(remaining, totalFunded)
  remaining -= rocPool

  // 3. Equity profit pool — split LP/GP, with optional promote above hurdle
  const equityPool = remaining
  let lpEquityPct = params.lpSplit
  let gpEquityPct = params.gpSplit
  // Promote: if a hurdle exists and the distribution exceeds hurdle IRR, GP gets a larger share
  // Simplified: if total distribution / totalFunded / holdYears > promoteHurdle → apply carry
  if (
    params.promoteHurdle != null &&
    params.promoteCarry != null &&
    holdYears > 0 &&
    distribution / Math.max(totalFunded, 1) / holdYears > params.promoteHurdle
  ) {
    gpEquityPct = params.promoteCarry
    lpEquityPct = 1 - params.promoteCarry
  }

  const gpCut = equityPool * gpEquityPct
  const lpCut = equityPool * lpEquityPct

  // Allocate pref, ROC, and LP equity to each LP by equity %
  const lpDistributions: WaterfallDistribution[] = investors.map(inv => {
    const pct = equityPcts.get(inv.id) ?? 0
    const prefEarned = inv.fundedAmount * params.preferredReturnRate * holdYears
    const prefPaid = prefPool * pct
    const roc = rocPool * pct
    const equity = lpCut * pct
    return {
      lpId: inv.id,
      name: inv.name,
      equityPct: pct,
      prefEarned,
      prefPaid,
      returnOfCapital: roc,
      equityProfit: equity,
      total: prefPaid + roc + equity,
    }
  })

  return {
    totalDistribution: distribution,
    prefPool,
    rocPool,
    equityPool,
    gpCut,
    lpCut,
    lpDistributions,
  }
}
