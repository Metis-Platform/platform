import { EXIT_META, type ExitKey } from '@/lib/exit-engine/keys'
import type { ExitResult, ParcelProfile } from '@/lib/exit-engine/types'
import type { MaoResult } from '@/lib/mao/calculator'
import type { BidGate } from '@/lib/parcel/bid-gates'

export type InvestmentDecisionStatus = 'PASS' | 'PURSUE' | 'VERIFY_BEFORE_ACTION' | 'INSUFFICIENT_EVIDENCE'

export interface InvestmentDecision {
  status: InvestmentDecisionStatus
  recommendedExit?: ExitKey
  recommendedExitLabel?: string
  summary: string
  reasons: string[]
  nextAction: string
  bidGuidance?: {
    conservative: number
    moderate: number
    aggressive: number
    basis: string
  }
}

const VACANT_EXIT_PRIORITY: ExitKey[] = [
  'VACANT_SELL_TO_BUILDER',
  'VACANT_SELL_AS_IS',
  'VACANT_HOLD',
  'VACANT_WHOLESALE',
  'LAND_SELLER_FINANCE',
]

const IMPROVED_EXIT_PRIORITY: ExitKey[] = [
  'IMPROVED_SELL_AS_IS',
  'IMPROVED_WHOLESALE',
  'IMPROVED_BUY_AND_HOLD',
  'IMPROVED_FLIP',
]

const PROPERTY_HARD_BLOCKERS = new Set([
  'Landlocked parcel lacks legal/physical road frontage',
  'Jurisdiction setbacks leave no buildable envelope',
])

export function buildInvestmentDecision(
  parcel: ParcelProfile,
  exits: ExitResult[],
  gates: BidGate[],
  mao: MaoResult[],
): InvestmentDecision {
  const priority = parcel.improved ? IMPROVED_EXIT_PRIORITY : VACANT_EXIT_PRIORITY
  const candidate = priority
    .map(key => exits.find(exit => exit.exitKey === key))
    .find((exit): exit is ExitResult => exit != null && exit.verdict !== 'NOT_VIABLE' && exit.verdict !== 'INSUFFICIENT_DATA')
  const hardBlocker = exits
    .flatMap(exit => exit.verdict === 'NOT_VIABLE' ? exit.blockers : [])
    .find(blocker => PROPERTY_HARD_BLOCKERS.has(blocker))
  const unresolvedGates = gates.filter(gate => gate.status === 'REVIEW_REQUIRED' || gate.status === 'FLAGGED')
  const bidGuidance = landBidGuidance(mao)

  if (!parcel.apn || (!parcel.lotSizeSqFt && !parcel.zoning && parcel.improved == null)) {
    return {
      status: 'INSUFFICIENT_EVIDENCE',
      summary: 'Metis does not have enough verified parcel evidence to rank an investment path.',
      reasons: ['Parcel identity, physical facts, and zoning/buildability evidence are incomplete.'],
      nextAction: 'Verify the parcel identity and obtain an official parcel baseline before evaluating an exit.',
    }
  }

  if (hardBlocker && !candidate) {
    return {
      status: 'PASS',
      summary: 'A documented physical constraint leaves no supported investment exit.',
      reasons: [hardBlocker],
      nextAction: 'Do not set a bid until a qualified professional documents a lawful exception or correction.',
    }
  }

  if (!candidate) {
    return {
      status: 'INSUFFICIENT_EVIDENCE',
      summary: 'No supported exit can be ranked from the currently available parcel evidence.',
      reasons: ['Every relevant exit is either blocked or lacks required facts.'],
      nextAction: unresolvedGates[0]?.nextStep ?? 'Obtain parcel, title, and jurisdiction evidence before setting a bid.',
      ...(bidGuidance ? { bidGuidance } : {}),
    }
  }

  const exitLabel = EXIT_META[candidate.exitKey].label
  const candidateReasons = [...candidate.blockers, ...candidate.conditions].slice(0, 2)
  const requiresVerification = unresolvedGates.length > 0 || candidate.verdict === 'CONDITIONAL'

  return {
    status: requiresVerification ? 'VERIFY_BEFORE_ACTION' : 'PURSUE',
    recommendedExit: candidate.exitKey,
    recommendedExitLabel: exitLabel,
    summary: requiresVerification
      ? `${exitLabel} is the most plausible current exit, but decisive diligence is still unresolved.`
      : `${exitLabel} is the highest-ranked supported exit from the available evidence.`,
    reasons: candidateReasons.length > 0
      ? candidateReasons
      : [`The parcel currently supports ${exitLabel.toLowerCase()} better than the other evaluated exits.`],
    nextAction: unresolvedGates[0]?.nextStep ?? candidate.conditions[0] ?? 'Validate current market demand before bidding.',
    ...(bidGuidance ? { bidGuidance } : {}),
  }
}

function landBidGuidance(mao: MaoResult[]): InvestmentDecision['bidGuidance'] | undefined {
  const land = mao.find(result => result.strategy === 'LAND')
  if (!land || land.scenario.conservative == null || land.scenario.moderate == null || land.scenario.aggressive == null) return undefined
  return {
    conservative: land.scenario.conservative,
    moderate: land.scenario.moderate,
    aggressive: land.scenario.aggressive,
    basis: land.basis,
  }
}
