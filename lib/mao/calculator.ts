import type { ExitResult, ParcelProfile } from '@/lib/exit-engine/types'

export interface MaoScenario {
  conservative: number | null
  moderate: number | null
  aggressive: number | null
}

export type MaoWarningType = 'unbuildable' | 'data_gap'

export interface MaoResult {
  strategy: string
  label: string
  scenario: MaoScenario
  basis: string
  warning?: string
  warningType?: MaoWarningType
}

const IMPROVED_EXIT_KEYS = new Set([
  'IMPROVED_SELL_AS_IS',
  'IMPROVED_FLIP',
  'IMPROVED_BUY_AND_HOLD',
  'IMPROVED_WHOLESALE',
  'FLIP_RENOVATE_AND_SELL',
  'FLIP_PIVOT_TO_RENT',
  'BH_LTR',
  'BH_STR',
  'BH_SECTION8',
])

const VACANT_BUILD_EXIT_KEYS = new Set([
  'VACANT_SELL_TO_BUILDER',
  'VACANT_BUILD_AND_SELL',
  'VACANT_SUBDIVIDE_AND_SELL',
])

export function computeMao(parcel: ParcelProfile, exitResults: ExitResult[]): MaoResult[] {
  const hasViableImproved = exitResults.some(r => r.verdict === 'VIABLE' && IMPROVED_EXIT_KEYS.has(r.exitKey))
  const hasViableVacantBuild = exitResults.some(r => r.verdict === 'VIABLE' && VACANT_BUILD_EXIT_KEYS.has(r.exitKey))

  // Exits explicitly ruled out (NOT_VIABLE) vs just missing data (INSUFFICIENT_DATA)
  const buildExplicitlyBlocked = exitResults.some(r =>
    r.verdict === 'NOT_VIABLE' &&
    (VACANT_BUILD_EXIT_KEYS.has(r.exitKey) || IMPROVED_EXIT_KEYS.has(r.exitKey)),
  )
  const buildDataGapOnly = !buildExplicitlyBlocked && exitResults.some(r =>
    r.verdict === 'INSUFFICIENT_DATA' &&
    (VACANT_BUILD_EXIT_KEYS.has(r.exitKey) || IMPROVED_EXIT_KEYS.has(r.exitKey)),
  )

  const rawLandWarning: { warning: string; warningType: MaoWarningType } | undefined =
    hasViableImproved || hasViableVacantBuild ? undefined
    : buildExplicitlyBlocked
      ? { warning: 'No viable residential exits — lot unbuildable. Raw land pricing only.', warningType: 'unbuildable' }
      : buildDataGapOnly
        ? { warning: 'Build exits need more data (zoning, lot size). Raw land pricing shown until resolved.', warningType: 'data_gap' }
        : undefined

  const results: MaoResult[] = []

  // Fix & Flip / Improved — requires ARV
  const arv = parcel.arv?.mid ?? parcel.estimatedArv
  const rehab = parcel.rehabCost?.mid ?? 35_000
  if (arv != null) {
    results.push({
      strategy: 'FIX_FLIP',
      label: 'Fix & Flip (70% rule)',
      scenario: {
        conservative: clamp(arv * 0.65 - rehab),
        moderate:     clamp(arv * 0.70 - rehab),
        aggressive:   clamp(arv * 0.75 - rehab),
      },
      basis: `ARV ${fmtCurrency(arv)} × 65-75% − rehab est. ${fmtCurrency(rehab)}`,
    })
  }

  // Raw land — always computed when assessed/market value is known
  const landValue = parcel.assessedValue ?? parcel.marketValueEstimate
  if (landValue != null) {
    results.push({
      strategy: 'LAND',
      label: 'Raw Land',
      scenario: {
        conservative: landValue * 0.40,
        moderate:     landValue * 0.60,
        aggressive:   landValue * 0.80,
      },
      basis: `Assessed value ${fmtCurrency(landValue)} × 40-80%`,
      ...rawLandWarning,
    })
  }

  // Buy & Hold — requires comparable rent
  const rent = parcel.comparableRent
  if (rent != null) {
    const annualNoi = rent * 12 * 0.60
    results.push({
      strategy: 'BUY_HOLD',
      label: 'Buy & Hold (cap rate)',
      scenario: {
        conservative: annualNoi / 0.12,
        moderate:     annualNoi / 0.10,
        aggressive:   annualNoi / 0.08,
      },
      basis: `Est. NOI ${fmtCurrency(annualNoi)}/yr ÷ cap rate 8-12%`,
    })
  }

  // Multifamily — requires NOI
  const noi = parcel.noi?.mid
  if (noi != null) {
    results.push({
      strategy: 'MULTIFAMILY',
      label: 'Multifamily (cap rate)',
      scenario: {
        conservative: noi / 0.10,
        moderate:     noi / 0.08,
        aggressive:   noi / 0.065,
      },
      basis: `NOI ${fmtCurrency(noi)}/yr ÷ cap rate 6.5-10%`,
    })
  }

  return results
}

function clamp(value: number): number {
  return Math.max(0, value)
}

function fmtCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`
  return `$${Math.round(value)}`
}
