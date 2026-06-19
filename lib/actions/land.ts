'use server'

import { z } from 'zod'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { generateLandEvents } from '@/lib/land-events'
import { applyTenantWorkflowRules } from '@/lib/workflow-rules'
import { emitAuditEvent } from '@/lib/audit'
import { StrategyType, DealStatus } from '@/app/generated/prisma'
import { hasStrategy } from '@/lib/entitlements'
import { normalizeApn } from '@/lib/parcel/apn'
import { assembleParcelProfile } from '@/lib/parcel/profile'
import { deriveLandSyncFields } from '@/lib/parcel/land-sync'

export type LandFormState = { errors?: Record<string, string[]>; message?: string }
export type LandSyncState = { message?: string; updated?: string[] }

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const optDecimal = z.coerce
  .number()
  .positive('Must be greater than 0')
  .optional()
  .or(z.literal(''))
  .transform(v => (v === '' ? undefined : v))

const BaseSchema = z.object({
  jurisdictionId: z.string().min(1, 'Jurisdiction is required'),
  apn:            z.string().min(1, 'APN / Parcel is required').max(60),
  address:        z.string().max(200).optional(),
  acres:          optDecimal,
  zoning:         z.string().max(100).optional(),
  access:         z.enum(['ROAD', 'EASEMENT', 'LANDLOCKED', 'NONE', 'UNKNOWN']).optional(),
  floodZone:      z.string().max(50).optional(),
  wetlandsPercent: z.coerce.number().min(0).max(100).optional().or(z.literal('')).transform(v => (v === '' ? undefined : v)),
  hoaName:        z.string().max(200).optional(),
  hoaFees:        optDecimal,
  optionExpiry:   z.string().optional(),
  purchasePrice:  optDecimal,
  purchaseDate:   z.string().optional(),
  notes:          z.string().max(2000).optional(),
  status:         z.enum(['LEAD', 'ACTIVE']).default('LEAD'),
})

// ---------------------------------------------------------------------------
// createLand
// ---------------------------------------------------------------------------

export async function createLand(_prev: LandFormState, formData: FormData): Promise<LandFormState> {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return { message: 'Not authenticated.' }

  const tenant = await db.tenant.findUnique({ where: { clerkOrgId: orgId } })
  if (!tenant) return { message: 'Account not found.' }
  if (!await hasStrategy(tenant.id, StrategyType.LAND)) return { message: 'Land strategy is not enabled for your account.' }

  const parsed = BaseSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors as Record<string, string[]> }

  const d = parsed.data
  let dealId: string

  try {
    const property = await db.property.upsert({
      where: { tenantId_apn_jurisdictionId: { tenantId: tenant.id, apn: d.apn, jurisdictionId: d.jurisdictionId } },
      update: {
        ...(d.address ? { address: d.address } : {}),
        ...(d.acres !== undefined ? { acres: d.acres } : {}),
      },
      create: {
        tenantId: tenant.id,
        jurisdictionId: d.jurisdictionId,
        apn: d.apn,
        ...(d.address ? { address: d.address } : {}),
        ...(d.acres !== undefined ? { acres: d.acres } : {}),
      },
    })

    const deal = await db.deal.create({
      data: {
        tenantId:      tenant.id,
        propertyId:    property.id,
        strategyType:  StrategyType.LAND,
        status:        d.status === 'ACTIVE' ? DealStatus.ACTIVE : DealStatus.LEAD,
        purchasePrice: d.purchasePrice ? Number(d.purchasePrice) : null,
        purchaseDate:  d.purchaseDate ? new Date(`${d.purchaseDate}T12:00:00.000Z`) : null,
        notes:         d.notes || null,
        land: {
          create: {
            zoning:          d.zoning || null,
            access:          d.access ?? null,
            floodZone:       d.floodZone || null,
            wetlandsPercent: d.wetlandsPercent !== undefined ? Number(d.wetlandsPercent) : null,
            hoaName:         d.hoaName || null,
            hoaFees:         d.hoaFees !== undefined ? Number(d.hoaFees) : null,
            optionExpiry:    d.optionExpiry ? new Date(`${d.optionExpiry}T12:00:00.000Z`) : null,
          },
        },
      },
    })
    dealId = deal.id
    await generateLandEvents(dealId, tenant.id)
    await applyTenantWorkflowRules(tenant.id, dealId)
    await emitAuditEvent(tenant.id, 'DEAL_CREATED', { dealId, strategy: 'LAND' }, userId)
  } catch (err) {
    console.error('[createLand]', err)
    return { message: 'Failed to save. Please try again.' }
  }

  redirect(`/dashboard/deals/${dealId}`)
}

// ---------------------------------------------------------------------------
// updateLand
// ---------------------------------------------------------------------------

export async function updateLand(dealId: string, _prev: LandFormState, formData: FormData): Promise<LandFormState> {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return { message: 'Not authenticated.' }

  const tenant = await db.tenant.findUnique({ where: { clerkOrgId: orgId } })
  if (!tenant) return { message: 'Account not found.' }

  const parsed = BaseSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors as Record<string, string[]> }

  const d = parsed.data

  try {
    const deal = await db.deal.findUnique({ where: { id: dealId, tenantId: tenant.id } })
    if (!deal) return { message: 'Deal not found.' }

    const property = await db.property.upsert({
      where: { tenantId_apn_jurisdictionId: { tenantId: tenant.id, apn: d.apn, jurisdictionId: d.jurisdictionId } },
      update: {
        ...(d.address ? { address: d.address } : {}),
        ...(d.acres !== undefined ? { acres: d.acres } : {}),
      },
      create: {
        tenantId: tenant.id,
        jurisdictionId: d.jurisdictionId,
        apn: d.apn,
        ...(d.address ? { address: d.address } : {}),
        ...(d.acres !== undefined ? { acres: d.acres } : {}),
      },
    })

    await db.deal.update({
      where: { id: dealId },
      data: {
        propertyId:    property.id,
        purchasePrice: d.purchasePrice !== undefined ? Number(d.purchasePrice) : null,
        purchaseDate:  d.purchaseDate ? new Date(`${d.purchaseDate}T12:00:00.000Z`) : null,
        notes:         d.notes || null,
      },
    })

    await db.dealLand.upsert({
      where: { dealId },
      update: {
        zoning:          d.zoning || null,
        access:          d.access ?? null,
        floodZone:       d.floodZone || null,
        wetlandsPercent: d.wetlandsPercent !== undefined ? Number(d.wetlandsPercent) : null,
        hoaName:         d.hoaName || null,
        hoaFees:         d.hoaFees !== undefined ? Number(d.hoaFees) : null,
        optionExpiry:    d.optionExpiry ? new Date(`${d.optionExpiry}T12:00:00.000Z`) : null,
      },
      create: {
        dealId,
        zoning:          d.zoning || null,
        access:          d.access ?? null,
        floodZone:       d.floodZone || null,
        wetlandsPercent: d.wetlandsPercent !== undefined ? Number(d.wetlandsPercent) : null,
        hoaName:         d.hoaName || null,
        hoaFees:         d.hoaFees !== undefined ? Number(d.hoaFees) : null,
        optionExpiry:    d.optionExpiry ? new Date(`${d.optionExpiry}T12:00:00.000Z`) : null,
      },
    })

    await generateLandEvents(dealId, tenant.id)
  } catch (err) {
    console.error('[updateLand]', err)
    return { message: 'Failed to update. Please try again.' }
  }

  redirect(`/dashboard/deals/${dealId}`)
}

// ---------------------------------------------------------------------------
// syncLandFromResearch
// ---------------------------------------------------------------------------

export async function syncLandFromResearch(
  dealId: string,
  _prev: LandSyncState,
  _formData: FormData,
): Promise<LandSyncState> {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return { message: 'Not authenticated.' }

  const tenant = await db.tenant.findUnique({ where: { clerkOrgId: orgId } })
  if (!tenant) return { message: 'Account not found.' }

  const deal = await db.deal.findFirst({
    where: { id: dealId, tenantId: tenant.id },
    include: { property: { include: { jurisdiction: true } }, land: true },
  })
  if (!deal || !deal.land) return { message: 'Land deal not found.' }

  const fipsCounty = deal.property.jurisdiction?.fips ?? ''
  const normalizedApn = normalizeApn(deal.property.apn, fipsCounty)

  const cacheRows = await db.parcelDataCache.findMany({
    where: { tenantId: tenant.id, apnNormalized: normalizedApn.normalized, fipsCounty },
  })

  const profile = assembleParcelProfile(deal, cacheRows)
  const acres = deal.property.acres != null ? Number(deal.property.acres.toString()) : null

  const updates = deriveLandSyncFields(
    profile,
    {
      zoning: deal.land.zoning,
      floodZone: deal.land.floodZone,
      access: deal.land.access,
      wetlandsPercent: deal.land.wetlandsPercent != null ? Number(deal.land.wetlandsPercent.toString()) : null,
    },
    acres,
  )

  if (Object.keys(updates).length === 0) {
    return { message: 'No new data available from research cache.' }
  }

  await db.dealLand.update({ where: { dealId }, data: updates })
  revalidatePath(`/dashboard/deals/${dealId}`)

  return { message: `Updated ${Object.keys(updates).join(', ')} from research data.`, updated: Object.keys(updates) }
}
