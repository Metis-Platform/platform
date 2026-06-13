'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@clerk/nextjs/server'
import { syncUserToDatabase } from '@/lib/sync-user'
import { db } from '@/lib/db'

export type RentalExpenseState = {
  error?: string
}

export type ExpenseItem = {
  category: string
  label: string
  monthlyAmount: number
}

export type RentalExpenses = {
  version: 1
  items: ExpenseItem[]
}

export const EXPENSE_CATEGORIES: { category: string; label: string }[] = [
  { category: 'property_tax',   label: 'Property Tax' },
  { category: 'insurance',      label: 'Insurance' },
  { category: 'hoa',            label: 'HOA' },
  { category: 'utilities',      label: 'Utilities' },
  { category: 'management',     label: 'Management Fee' },
  { category: 'maintenance',    label: 'Maintenance Reserve' },
  { category: 'other',          label: 'Other' },
]

export async function saveOperatingExpenses(
  dealId: string,
  _prev: RentalExpenseState,
  formData: FormData,
): Promise<RentalExpenseState> {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return { error: 'Not authenticated' }
  const synced = await syncUserToDatabase()
  if (!synced) return { error: 'Tenant not found' }
  const { tenant } = synced

  const deal = await db.deal.findUnique({ where: { id: dealId, tenantId: tenant.id } })
  if (!deal) return { error: 'Deal not found' }

  const items: ExpenseItem[] = EXPENSE_CATEGORIES.map(c => ({
    category: c.category,
    label: c.label,
    monthlyAmount: parseFloat((formData.get(`expense_${c.category}`) as string) || '0') || 0,
  }))

  const expenses: RentalExpenses = { version: 1, items }

  await db.dealBuyHold.update({
    where: { dealId },
    data: { operatingExpenses: expenses },
  })

  revalidatePath(`/dashboard/deals/${dealId}`)
  return {}
}
