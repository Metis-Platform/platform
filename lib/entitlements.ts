import { db } from '@/lib/db'
import type { StrategyType } from '@/app/generated/prisma'

export async function hasStrategy(tenantId: string, strategy: StrategyType): Promise<boolean> {
  const row = await db.tenantModule.findUnique({
    where: { tenantId_strategy: { tenantId, strategy } },
    select: { id: true },
  })
  return row !== null
}

export async function hasTier(
  tenantId: string,
  strategy: StrategyType,
  tier: 'PREMIUM',
): Promise<boolean> {
  const row = await db.tenantModule.findUnique({
    where: { tenantId_strategy: { tenantId, strategy } },
    select: { tier: true },
  })
  return row?.tier === tier
}

export async function getEnabledStrategies(tenantId: string): Promise<StrategyType[]> {
  const modules = await db.tenantModule.findMany({
    where: { tenantId },
    select: { strategy: true },
  })
  return modules.map(m => m.strategy)
}
