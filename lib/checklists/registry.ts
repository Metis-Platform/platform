import type { StrategyType } from '@/app/generated/prisma'
import type { ChecklistTemplate } from './types'
import { landTemplate } from './templates/land'

const REGISTRY: Partial<Record<StrategyType, ChecklistTemplate>> = {
  LAND: landTemplate,
}

export function getTemplate(strategy: StrategyType): ChecklistTemplate | null {
  return REGISTRY[strategy] ?? null
}

export function hasTemplate(strategy: StrategyType): boolean {
  return strategy in REGISTRY
}
