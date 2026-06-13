'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@clerk/nextjs/server'
import { syncUserToDatabase } from '@/lib/sync-user'
import { db } from '@/lib/db'
import { BusinessPlanSchema } from '@/lib/multifamily-schemas'

export type BusinessPlanState = { error?: string; success?: boolean }

export async function saveBusinessPlan(
  dealId: string,
  _prev: BusinessPlanState,
  formData: FormData,
): Promise<BusinessPlanState> {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return { error: 'Not authenticated' }
  const synced = await syncUserToDatabase()
  if (!synced) return { error: 'Tenant not found' }
  const { tenant } = synced

  const deal = await db.deal.findUnique({ where: { id: dealId, tenantId: tenant.id }, select: { id: true } })
  if (!deal) return { error: 'Deal not found' }

  const result = BusinessPlanSchema.safeParse({
    renovationLiftPerUnit: parseFloat(formData.get('renovationLiftPerUnit') as string) || 0,
    unitsRenovated:        parseInt(formData.get('unitsRenovated') as string, 10) || 0,
    targetUnitsToRenovate: parseInt(formData.get('targetUnitsToRenovate') as string, 10) || 1,
    stabilizedNoiTarget:   parseFloat(formData.get('stabilizedNoiTarget') as string) || 0,
    notes:                 (formData.get('notes') as string) || null,
  })

  if (!result.success) return { error: result.error.issues[0]?.message ?? 'Invalid business plan data' }

  await db.dealMultifamily.update({
    where: { dealId },
    data: { businessPlan: result.data as object },
  })

  revalidatePath(`/dashboard/deals/${dealId}`)
  return { success: true }
}
