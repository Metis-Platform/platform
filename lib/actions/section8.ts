'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@clerk/nextjs/server'
import { syncUserToDatabase } from '@/lib/sync-user'
import { db } from '@/lib/db'
import { hasTier } from '@/lib/entitlements'
import { generateBuyHoldEvents } from '@/lib/buy-hold-events'

export type Section8State = { error?: string; success?: boolean }

function parseDec(v: string | null) {
  if (!v) return null
  const n = parseFloat(v)
  return isNaN(n) ? null : n
}
function parseDate(v: string | null) {
  if (!v) return null
  const d = new Date(v)
  return isNaN(d.getTime()) ? null : d
}
function parseInt2(v: string | null) {
  if (!v) return null
  const n = parseInt(v, 10)
  return isNaN(n) ? null : n
}
function fd(formData: FormData, key: string) {
  return (formData.get(key) as string)?.trim() || null
}

export async function saveSection8(
  dealId: string,
  _prev: Section8State,
  formData: FormData,
): Promise<Section8State> {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return { error: 'Not authenticated' }
  const synced = await syncUserToDatabase()
  if (!synced) return { error: 'Tenant not found' }
  const { tenant } = synced

  if (!await hasTier(tenant.id, 'BUY_HOLD', 'PREMIUM')) {
    return { error: 'Section 8 engine requires Buy & Hold PREMIUM tier.' }
  }

  const deal = await db.deal.findUnique({ where: { id: dealId, tenantId: tenant.id }, select: { id: true } })
  if (!deal) return { error: 'Deal not found' }

  await db.dealBuyHold.update({
    where: { dealId },
    data: {
      hapContractNumber:     fd(formData, 'hapContractNumber'),
      hapMonthlyAmount:      parseDec(fd(formData, 'hapMonthlyAmount')),
      tenantPortion:         parseDec(fd(formData, 'tenantPortion')),
      hapAnniversary:        parseDate(fd(formData, 'hapAnniversary')),
      nextHqsDate:           parseDate(fd(formData, 'nextHqsDate')),
      hqsResult:             fd(formData, 'hqsResult'),
      fmrBedrooms:           parseInt2(fd(formData, 'fmrBedrooms')),
      rentIncreaseNoticeDays: parseInt2(fd(formData, 'rentIncreaseNoticeDays')) ?? 60,
    },
  })

  await generateBuyHoldEvents(dealId)
  revalidatePath(`/dashboard/deals/${dealId}`)
  return { success: true }
}
