'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@clerk/nextjs/server'
import { syncUserToDatabase } from '@/lib/sync-user'
import { db } from '@/lib/db'
import { hasStrategy } from '@/lib/entitlements'
import { T12FinancialsSchema, parseT12Csv } from '@/lib/multifamily-schemas'

export type T12State = { error?: string; success?: boolean }

export async function saveT12(
  dealId: string,
  _prev: T12State,
  formData: FormData,
): Promise<T12State> {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return { error: 'Not authenticated' }
  const synced = await syncUserToDatabase()
  if (!synced) return { error: 'Tenant not found' }
  const { tenant } = synced
  if (!await hasStrategy(tenant.id, 'MULTIFAMILY')) return { error: 'Multifamily strategy is not enabled for your account.' }

  const deal = await db.deal.findUnique({ where: { id: dealId, tenantId: tenant.id }, select: { id: true } })
  if (!deal) return { error: 'Deal not found' }

  // CSV path
  const csvRaw = formData.get('csv') as string | null
  if (csvRaw) {
    const yearRaw = formData.get('year') as string | null
    const year = yearRaw ? parseInt(yearRaw, 10) : null
    const parsed = parseT12Csv(csvRaw, isNaN(year!) ? null : year)
    if (!parsed) return { error: 'Could not parse CSV. Expected: Category,Type,Jan,Feb,...,Dec' }

    await db.dealMultifamily.update({
      where: { dealId },
      data: { t12Financials: parsed as object },
    })
    revalidatePath(`/dashboard/deals/${dealId}`)
    return { success: true }
  }

  // Direct JSON path (for clearing or manual edit)
  const jsonRaw = formData.get('t12') as string | null
  if (jsonRaw) {
    let parsed: unknown
    try { parsed = JSON.parse(jsonRaw) } catch { return { error: 'Invalid JSON' } }

    const result = T12FinancialsSchema.safeParse(parsed)
    if (!result.success) return { error: result.error.issues[0]?.message ?? 'Invalid T12 data' }

    await db.dealMultifamily.update({
      where: { dealId },
      data: { t12Financials: result.data as object },
    })
    revalidatePath(`/dashboard/deals/${dealId}`)
    return { success: true }
  }

  return { error: 'No data provided' }
}
