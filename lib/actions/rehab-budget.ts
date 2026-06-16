'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@clerk/nextjs/server'
import { syncUserToDatabase } from '@/lib/sync-user'
import { db } from '@/lib/db'
import { hasStrategy } from '@/lib/entitlements'

export type RehabBudgetState = {
  error?: string
}

export type LineItem = {
  id: string
  category: string
  description: string
  budgeted: number
  actual: number | null
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETE'
}

export type ScopeOfWork = {
  version: 1
  items: LineItem[]
}

export async function saveScopeOfWork(
  dealId: string,
  _prev: RehabBudgetState,
  formData: FormData,
): Promise<RehabBudgetState> {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return { error: 'Not authenticated' }
  const synced = await syncUserToDatabase()
  if (!synced) return { error: 'Tenant not found' }
  const { tenant } = synced
  if (!await hasStrategy(tenant.id, 'FIX_FLIP')) return { error: 'Fix & Flip strategy is not enabled for your account.' }

  const deal = await db.deal.findUnique({ where: { id: dealId, tenantId: tenant.id } })
  if (!deal) return { error: 'Deal not found' }

  const raw = formData.get('scopeOfWork') as string
  let scope: ScopeOfWork
  try {
    scope = JSON.parse(raw) as ScopeOfWork
  } catch {
    return { error: 'Invalid scope of work data' }
  }

  const totalBudgeted = scope.items.reduce((s, i) => s + i.budgeted, 0)
  const totalActual   = scope.items.reduce((s, i) => s + (i.actual ?? 0), 0)
  const hasActuals    = scope.items.some(i => i.actual != null)

  await db.dealFixFlip.update({
    where: { dealId },
    data: {
      scopeOfWork:    scope,
      rehabBudget:    totalBudgeted || null,
      rehabActualCost: hasActuals ? totalActual : undefined,
    },
  })

  revalidatePath(`/dashboard/deals/${dealId}`)
  return {}
}
