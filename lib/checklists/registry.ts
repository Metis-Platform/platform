import type { StrategyType } from '@/app/generated/prisma'
import type { ChecklistTemplate } from './types'
import { landTemplate } from './templates/land'
import { taxLienTemplate } from './templates/tax-lien'
import { taxDeedTemplate } from './templates/tax-deed'
import { foreclosureTemplate } from './templates/foreclosure'

const REGISTRY: Partial<Record<StrategyType, ChecklistTemplate>> = {
  LAND:        landTemplate,
  TAX_LIEN:    taxLienTemplate,
  TAX_DEED:    taxDeedTemplate,
  FORECLOSURE: foreclosureTemplate,
}

export function getTemplate(strategy: StrategyType): ChecklistTemplate | null {
  return REGISTRY[strategy] ?? null
}

export function hasTemplate(strategy: StrategyType): boolean {
  return strategy in REGISTRY
}
