'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@clerk/nextjs/server'
import { syncUserToDatabase } from '@/lib/sync-user'
import { db } from '@/lib/db'
import { hasStrategy } from '@/lib/entitlements'
import { generateMultifamilyEvents } from '@/lib/multifamily-events'
import { RentRollSchema, computeRentRollMetrics } from '@/lib/multifamily-schemas'

export type RentRollState = { error?: string }

export async function saveRentRoll(
  dealId: string,
  _prev: RentRollState,
  formData: FormData,
): Promise<RentRollState> {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return { error: 'Not authenticated' }
  const synced = await syncUserToDatabase()
  if (!synced) return { error: 'Tenant not found' }
  const { tenant } = synced
  if (!await hasStrategy(tenant.id, 'MULTIFAMILY')) return { error: 'Multifamily strategy is not enabled for your account.' }

  const deal = await db.deal.findUnique({
    where: { id: dealId, tenantId: tenant.id },
    select: { id: true, purchasePrice: true },
  })
  if (!deal) return { error: 'Deal not found' }

  const raw = formData.get('rentRoll') as string | null
  if (!raw) return { error: 'Rent roll data missing' }

  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { return { error: 'Invalid rent roll format' } }

  const result = RentRollSchema.safeParse(parsed)
  if (!result.success) return { error: result.error.issues[0]?.message ?? 'Invalid rent roll' }

  const roll = result.data
  const metrics = computeRentRollMetrics(roll)

  // Recompute NOI and cap rate using updated GSI from rent roll
  const mf = await db.dealMultifamily.findUnique({ where: { dealId } })
  const opex = (mf?.operatingExpenses as { total?: number } | null)?.total ?? 0
  const vacancyRate = metrics.vacancyRate
  const egi = metrics.gsi * (1 - vacancyRate)
  const noi = egi - opex
  const purchasePrice = deal.purchasePrice ? Number(deal.purchasePrice) : null
  const capRate = purchasePrice && purchasePrice > 0 ? noi / purchasePrice : null

  await db.$transaction(async tx => {
    await tx.dealMultifamily.upsert({
      where: { dealId },
      create: {
        dealId,
        rentRoll: roll as object,
        unitCount: metrics.total,
        occupiedUnits: metrics.occupied,
        averageMonthlyRent: metrics.avgRent,
        vacancyRate: metrics.vacancyRate,
        grossScheduledIncome: metrics.gsi,
        netOperatingIncome: noi,
        capRate,
      },
      update: {
        rentRoll: roll as object,
        unitCount: metrics.total,
        occupiedUnits: metrics.occupied,
        averageMonthlyRent: metrics.avgRent,
        vacancyRate: metrics.vacancyRate,
        grossScheduledIncome: metrics.gsi,
        netOperatingIncome: noi,
        capRate,
      },
    })
  })

  await generateMultifamilyEvents(dealId)
  revalidatePath(`/dashboard/deals/${dealId}`)
  return {}
}
