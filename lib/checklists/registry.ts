import type { StrategyType } from '@/app/generated/prisma'
import type { ChecklistTemplate, ChecklistItem } from './types'
import { landTemplate } from './templates/land'
import { taxLienTemplate } from './templates/tax-lien'
import { taxDeedTemplate } from './templates/tax-deed'
import { foreclosureTemplate } from './templates/foreclosure'
import { db } from '@/lib/db'

const REGISTRY: Partial<Record<StrategyType, ChecklistTemplate>> = {
  LAND:        landTemplate,
  TAX_LIEN:    taxLienTemplate,
  TAX_DEED:    taxDeedTemplate,
  FORECLOSURE: foreclosureTemplate,
}

export async function getTemplate(strategy: StrategyType, tenantId?: string): Promise<ChecklistTemplate | null> {
  try {
    // Try tenant override first, then system template
    const row = tenantId
      ? await db.checklistTemplate.findFirst({
          where: { strategy, isActive: true, tenantId },
        }) ?? await db.checklistTemplate.findFirst({
          where: { strategy, isActive: true, tenantId: null },
        })
      : await db.checklistTemplate.findFirst({
          where: { strategy, isActive: true, tenantId: null },
        })

    if (row) {
      return { strategy: row.strategy, label: row.name, items: row.items as unknown as ChecklistItem[] }
    }
  } catch {
    // DB unavailable — fall through to hardcoded
  }
  return REGISTRY[strategy] ?? null
}

export function hasTemplate(strategy: StrategyType): boolean {
  return strategy in REGISTRY
}
