'use server'

import { z } from 'zod'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { StrategyType, DealStatus } from '@/app/generated/prisma'
import { hasStrategy } from '@/lib/entitlements'
import { generateWholesaleEvents } from '@/lib/wholesale-events'
import { applyTenantWorkflowRules } from '@/lib/workflow-rules'
import { emitAuditEvent } from '@/lib/audit'

export type WholesaleFormState = { errors?: Record<string, string[]>; message?: string }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const optDecimal = z.coerce
  .number()
  .positive('Must be greater than 0')
  .optional()
  .or(z.literal(''))
  .transform(v => (v === '' ? undefined : v))

const optDate = z
  .string()
  .optional()
  .transform(v => (v ? new Date(`${v}T12:00:00.000Z`) : undefined))

const BaseSchema = z.object({
  jurisdictionId:    z.string().min(1, 'Jurisdiction is required'),
  apn:               z.string().min(1, 'APN / Parcel is required').max(60),
  address:           z.string().max(200).optional(),
  leadSource:        z.string().max(100).optional(),
  contractDate:      optDate,
  contractPrice:     optDecimal,
  earnestMoney:      optDecimal,
  inspectionDeadline: optDate,
  closingDeadline:   optDate,
  assignmentFee:     optDecimal,
  buyerName:         z.string().max(200).optional(),
  buyerEmail:        z.string().email('Invalid email').optional().or(z.literal('')),
  buyerPhone:        z.string().max(30).optional(),
  marketingNotes:    z.string().max(2000).optional(),
  notes:             z.string().max(2000).optional(),
})

// ---------------------------------------------------------------------------
// createWholesale
// ---------------------------------------------------------------------------

export async function createWholesale(
  _prev: WholesaleFormState,
  formData: FormData,
): Promise<WholesaleFormState> {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return { message: 'Not authenticated.' }

  const tenant = await db.tenant.findUnique({ where: { clerkOrgId: orgId } })
  if (!tenant) return { message: 'Account not found.' }
  if (!await hasStrategy(tenant.id, StrategyType.WHOLESALE)) return { message: 'Wholesale strategy is not enabled for your account.' }

  const parsed = BaseSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors as Record<string, string[]> }

  const d = parsed.data
  let dealId: string

  try {
    const property = await db.property.upsert({
      where: { tenantId_apn_jurisdictionId: { tenantId: tenant.id, apn: d.apn, jurisdictionId: d.jurisdictionId } },
      update: { ...(d.address ? { address: d.address } : {}) },
      create: {
        tenantId: tenant.id,
        jurisdictionId: d.jurisdictionId,
        apn: d.apn,
        ...(d.address ? { address: d.address } : {}),
      },
    })

    const hasContract = !!(d.contractDate || d.contractPrice)

    const deal = await db.deal.create({
      data: {
        tenantId:     tenant.id,
        propertyId:   property.id,
        strategyType: StrategyType.WHOLESALE,
        status:       hasContract ? DealStatus.ACTIVE : DealStatus.LEAD,
        notes:        d.notes || null,
        wholesale: {
          create: {
            leadSource:         d.leadSource || null,
            contractDate:       d.contractDate ?? null,
            contractPrice:      d.contractPrice !== undefined ? Number(d.contractPrice) : null,
            earnestMoney:       d.earnestMoney !== undefined ? Number(d.earnestMoney) : null,
            inspectionDeadline: d.inspectionDeadline ?? null,
            closingDeadline:    d.closingDeadline ?? null,
            assignmentFee:      d.assignmentFee !== undefined ? Number(d.assignmentFee) : null,
            buyerName:          d.buyerName || null,
            buyerEmail:         d.buyerEmail || null,
            buyerPhone:         d.buyerPhone || null,
            marketingNotes:     d.marketingNotes || null,
            dispositionStatus:  hasContract ? 'MARKETING' : null,
          },
        },
      },
    })
    dealId = deal.id
    await generateWholesaleEvents(dealId, tenant.id)
    await applyTenantWorkflowRules(tenant.id, dealId)
    await emitAuditEvent(tenant.id, 'DEAL_CREATED', { dealId, strategy: 'WHOLESALE' }, userId)
  } catch (err) {
    console.error('[createWholesale]', err)
    return { message: 'Failed to save. Please try again.' }
  }

  redirect(`/dashboard/deals/${dealId}`)
}

// ---------------------------------------------------------------------------
// updateWholesale
// ---------------------------------------------------------------------------

export async function updateWholesale(
  dealId: string,
  _prev: WholesaleFormState,
  formData: FormData,
): Promise<WholesaleFormState> {
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
      update: { ...(d.address ? { address: d.address } : {}) },
      create: {
        tenantId: tenant.id,
        jurisdictionId: d.jurisdictionId,
        apn: d.apn,
        ...(d.address ? { address: d.address } : {}),
      },
    })

    await db.deal.update({
      where: { id: dealId },
      data: { propertyId: property.id, notes: d.notes || null },
    })

    await db.dealWholesale.upsert({
      where: { dealId },
      update: {
        leadSource:         d.leadSource || null,
        contractDate:       d.contractDate ?? null,
        contractPrice:      d.contractPrice !== undefined ? Number(d.contractPrice) : null,
        earnestMoney:       d.earnestMoney !== undefined ? Number(d.earnestMoney) : null,
        inspectionDeadline: d.inspectionDeadline ?? null,
        closingDeadline:    d.closingDeadline ?? null,
        assignmentFee:      d.assignmentFee !== undefined ? Number(d.assignmentFee) : null,
        buyerName:          d.buyerName || null,
        buyerEmail:         d.buyerEmail || null,
        buyerPhone:         d.buyerPhone || null,
        marketingNotes:     d.marketingNotes || null,
      },
      create: {
        dealId,
        leadSource:         d.leadSource || null,
        contractDate:       d.contractDate ?? null,
        contractPrice:      d.contractPrice !== undefined ? Number(d.contractPrice) : null,
        earnestMoney:       d.earnestMoney !== undefined ? Number(d.earnestMoney) : null,
        inspectionDeadline: d.inspectionDeadline ?? null,
        closingDeadline:    d.closingDeadline ?? null,
        assignmentFee:      d.assignmentFee !== undefined ? Number(d.assignmentFee) : null,
        buyerName:          d.buyerName || null,
        buyerEmail:         d.buyerEmail || null,
        buyerPhone:         d.buyerPhone || null,
        marketingNotes:     d.marketingNotes || null,
      },
    })

    await generateWholesaleEvents(dealId, tenant.id)
  } catch (err) {
    console.error('[updateWholesale]', err)
    return { message: 'Failed to update. Please try again.' }
  }

  redirect(`/dashboard/deals/${dealId}`)
}

// ---------------------------------------------------------------------------
// updateWholesaleDisposition
// ---------------------------------------------------------------------------

export async function updateWholesaleDisposition(
  dealId: string,
  targetDealStatus: string,
  targetDisposition: string,
  _prev: WholesaleFormState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData,
): Promise<WholesaleFormState> {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return { message: 'Not authenticated.' }

  const tenant = await db.tenant.findUnique({ where: { clerkOrgId: orgId } })
  if (!tenant) return { message: 'Account not found.' }

  const deal = await db.deal.findUnique({ where: { id: dealId, tenantId: tenant.id } })
  if (!deal) return { message: 'Deal not found.' }

  try {
    await db.$transaction(async (tx) => {
      if (targetDealStatus && deal.status !== targetDealStatus) {
        await tx.deal.update({ where: { id: dealId }, data: { status: targetDealStatus as DealStatus } })
      }
      await tx.dealWholesale.upsert({
        where: { dealId },
        update: { dispositionStatus: targetDisposition || null },
        create: { dealId, dispositionStatus: targetDisposition || null },
      })
    })
  } catch (err) {
    console.error('[updateWholesaleDisposition]', err)
    return { message: 'Failed to update. Please try again.' }
  }

  revalidatePath(`/dashboard/deals/${dealId}`)
  return {}
}
