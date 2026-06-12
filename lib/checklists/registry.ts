import type { StrategyType } from '@/app/generated/prisma'
import type { ChecklistTemplate } from './types'

/**
 * Registry of checklist templates keyed by StrategyType.
 *
 * Phase 1: intentionally empty — the registry exists so the "Generate Checklist"
 * button only appears for strategies that have a registered template.
 *
 * Phase 2: add real templates here (lien/deed/foreclosure DD checklists).
 * Each template is reviewed in a PR before it goes live.
 */
const REGISTRY: Partial<Record<StrategyType, ChecklistTemplate>> = {}

export function getTemplate(strategy: StrategyType): ChecklistTemplate | null {
  return REGISTRY[strategy] ?? null
}

export function hasTemplate(strategy: StrategyType): boolean {
  return strategy in REGISTRY
}
