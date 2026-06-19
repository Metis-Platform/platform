'use server'

import { z } from 'zod'
import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { hasStrategy } from '@/lib/entitlements'

export type LandCompFormState = { errors?: Record<string, string[]>; message?: string }

const optStr = z.string().max(200).optional().or(z.literal('')).transform(v => v || null)

const CreateCompSchema = z.object({
  address:   optStr,
  apn:       z.string().max(60).optional().or(z.literal('')).transform(v => v || null),
  acres:     z.coerce.number().positive('Acres must be > 0'),
  salePrice: z.coerce.number().positive('Sale price must be > 0'),
  saleDate:  z.string().min(1, 'Sale date is required'),
  sourceUrl: z.string().url('Invalid URL').optional().or(z.literal('')).transform(v => v || null),
  notes:     z.string().max(2000).optional(),
})

// ---------------------------------------------------------------------------
// createLandComp
// ---------------------------------------------------------------------------

export async function createLandComp(
  dealId: string,
  _prev: LandCompFormState,
  formData: FormData,
): Promise<LandCompFormState> {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return { message: 'Not authenticated.' }

  const tenant = await db.tenant.findUnique({ where: { clerkOrgId: orgId } })
  if (!tenant) return { message: 'Account not found.' }
  if (!await hasStrategy(tenant.id, 'LAND')) return { message: 'Land strategy is not enabled for your account.' }

  const parsed = CreateCompSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors as Record<string, string[]> }

  const deal = await db.deal.findUnique({ where: { id: dealId, tenantId: tenant.id } })
  if (!deal) return { message: 'Deal not found.' }

  const d = parsed.data

  try {
    await db.landComp.create({
      data: {
        dealId,
        tenantId:  tenant.id,
        address:   d.address,
        apn:       d.apn,
        acres:     d.acres,
        salePrice: d.salePrice,
        saleDate:  new Date(`${d.saleDate}T12:00:00.000Z`),
        sourceUrl: d.sourceUrl,
        notes:     d.notes || null,
      },
    })
  } catch (err) {
    console.error('[createLandComp]', err)
    return { message: 'Failed to add comp. Please try again.' }
  }

  revalidatePath(`/dashboard/deals/${dealId}`)
  return {}
}

// ---------------------------------------------------------------------------
// deleteLandComp
// ---------------------------------------------------------------------------

export async function deleteLandComp(dealId: string, compId: string): Promise<void> {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return

  const tenant = await db.tenant.findUnique({ where: { clerkOrgId: orgId } })
  if (!tenant) return

  await db.landComp.deleteMany({ where: { id: compId, dealId, tenantId: tenant.id } })
  revalidatePath(`/dashboard/deals/${dealId}`)
}
