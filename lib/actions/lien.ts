'use server'

import { z } from 'zod'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { generateEventsForDeal } from '@/lib/rules-engine'
import { applyTenantWorkflowRules } from '@/lib/workflow-rules'
import { emitAuditEvent } from '@/lib/audit'
import { getCurrentUser, hasRole } from '@/lib/auth'
import { StrategyType, DealStatus } from '@/app/generated/prisma'
import { hasStrategy } from '@/lib/entitlements'

export type LienFormState = { errors?: Record<string, string[]>; message?: string }

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const LeadSchema = z.object({
  status:        z.literal('LEAD'),
  jurisdictionId: z.string().min(1, 'Jurisdiction is required'),
  apn:           z.string().min(1, 'APN is required').max(60),
  address:       z.string().max(200).optional(),
  auctionDate:   z.string().optional(),
  maxBid:        z.coerce.number().positive('Must be greater than 0').optional().or(z.literal('')).transform(v => v === '' ? undefined : v),
  notes:         z.string().max(2000).optional(),
  researchSnapshotId: z.string().optional(),
})

const ActiveSchema = z.object({
  status:            z.literal('ACTIVE'),
  jurisdictionId:    z.string().min(1, 'Jurisdiction is required'),
  apn:               z.string().min(1, 'APN is required').max(60),
  address:           z.string().max(200).optional(),
  certificateNumber: z.string().min(1, 'Certificate number is required').max(60),
  faceAmount:        z.coerce.number({ error: 'Must be a number' }).positive('Must be greater than 0'),
  interestRate:      z.coerce.number({ error: 'Must be a number' }).min(0).max(100),
  issueDate:         z.string().min(1, 'Issue date is required'),
  notes:             z.string().max(2000).optional(),
})

const ConvertSchema = z.object({
  certificateNumber: z.string().min(1, 'Certificate number is required').max(60),
  faceAmount:        z.coerce.number({ error: 'Must be a number' }).positive('Must be greater than 0'),
  interestRate:      z.coerce.number({ error: 'Must be a number' }).min(0).max(100),
  issueDate:         z.string().min(1, 'Issue date is required'),
  notes:             z.string().max(2000).optional(),
})

const UpdateLienSchema = z.object({
  jurisdictionId:    z.string().min(1, 'Jurisdiction is required'),
  apn:               z.string().min(1, 'APN is required').max(60),
  address:           z.string().max(200).optional(),
  certificateNumber: z.string().min(1, 'Certificate number is required').max(60),
  faceAmount:        z.coerce.number({ error: 'Must be a number' }).positive('Must be greater than 0'),
  interestRate:      z.coerce.number({ error: 'Must be a number' }).min(0).max(100),
  issueDate:         z.string().min(1, 'Issue date is required'),
  notes:             z.string().max(2000).optional(),
})

// Tax Deed schemas
const DeedLeadSchema = z.object({
  status:        z.literal('LEAD'),
  jurisdictionId: z.string().min(1, 'Jurisdiction is required'),
  apn:           z.string().min(1, 'APN is required').max(60),
  address:       z.string().max(200).optional(),
  auctionDate:   z.string().optional(),
  maxBid:        z.coerce.number().positive('Must be greater than 0').optional().or(z.literal('')).transform(v => v === '' ? undefined : v),
  notes:         z.string().max(2000).optional(),
})

const DeedActiveSchema = z.object({
  status:              z.literal('ACTIVE'),
  jurisdictionId:      z.string().min(1, 'Jurisdiction is required'),
  apn:                 z.string().min(1, 'APN is required').max(60),
  address:             z.string().max(200).optional(),
  saleDate:            z.string().min(1, 'Sale date is required'),
  openingBid:          z.coerce.number({ error: 'Must be a number' }).positive('Must be greater than 0').optional().or(z.literal('')).transform(v => v === '' ? undefined : v),
  winningBid:          z.coerce.number({ error: 'Must be a number' }).positive('Must be greater than 0'),
  redemptionPeriodDays: z.coerce.number().int().positive('Must be a positive integer').optional().or(z.literal('')).transform(v => v === '' ? undefined : Number(v)),
  notes:               z.string().max(2000).optional(),
})

// Foreclosure schemas
const ForeclosureLeadSchema = z.object({
  status:         z.literal('LEAD'),
  jurisdictionId: z.string().min(1, 'Jurisdiction is required'),
  apn:            z.string().min(1, 'APN is required').max(60),
  address:        z.string().max(200).optional(),
  auctionDate:    z.string().optional(),
  maxBid:         z.coerce.number().positive('Must be greater than 0').optional().or(z.literal('')).transform(v => v === '' ? undefined : v),
  foreclosureType: z.enum(['MORTGAGE', 'TAX', 'HOA']).default('MORTGAGE'),
  estimatedLiens: z.coerce.number().positive().optional().or(z.literal('')).transform(v => v === '' ? undefined : v),
  notes:          z.string().max(2000).optional(),
})

const ForeclosureActiveSchema = z.object({
  status:         z.literal('ACTIVE'),
  jurisdictionId: z.string().min(1, 'Jurisdiction is required'),
  apn:            z.string().min(1, 'APN is required').max(60),
  address:        z.string().max(200).optional(),
  auctionDate:    z.string().min(1, 'Auction date is required'),
  openingBid:     z.coerce.number().positive('Must be greater than 0').optional().or(z.literal('')).transform(v => v === '' ? undefined : v),
  winningBid:     z.coerce.number({ error: 'Must be a number' }).positive('Must be greater than 0'),
  foreclosureType: z.enum(['MORTGAGE', 'TAX', 'HOA']).default('MORTGAGE'),
  notes:          z.string().max(2000).optional(),
})

// ---------------------------------------------------------------------------
// createLien
// ---------------------------------------------------------------------------

export async function createLien(_prev: LienFormState, formData: FormData): Promise<LienFormState> {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return { message: 'Not authenticated.' }

  const tenant = await db.tenant.findUnique({ where: { clerkOrgId: orgId } })
  if (!tenant) return { message: 'Account not found.' }
  if (!await hasStrategy(tenant.id, StrategyType.TAX_LIEN)) return { message: 'Tax Lien strategy is not enabled for your account.' }

  const raw = Object.fromEntries(formData)
  const schema = raw.status === 'LEAD'
    ? LeadSchema
    : ActiveSchema

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parsed = (schema as any).safeParse(raw)
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors }

  const data = parsed.data
  let dealId: string

  try {
    if (data.status === 'LEAD' && data.researchSnapshotId) {
      const deal = await db.$transaction(async tx => {
        const claimed = await tx.prePurchaseResearchSnapshot.updateMany({
          where: {
            id: data.researchSnapshotId,
            tenantId: tenant.id,
            jurisdictionId: data.jurisdictionId,
            apn: data.apn,
            consumedAt: null,
            expiresAt: { gt: new Date() },
          },
          data: { consumedAt: new Date() },
        })
        if (claimed.count !== 1) throw new Error('Research snapshot is unavailable.')

        const property = await tx.property.upsert({
          where: { tenantId_apn_jurisdictionId: { tenantId: tenant.id, apn: data.apn, jurisdictionId: data.jurisdictionId } },
          update: { ...(data.address ? { address: data.address } : {}) },
          create: { tenantId: tenant.id, jurisdictionId: data.jurisdictionId, apn: data.apn, ...(data.address ? { address: data.address } : {}) },
        })
        const created = await tx.deal.create({
          data: {
            tenantId: tenant.id, propertyId: property.id,
            strategyType: StrategyType.TAX_LIEN, status: DealStatus.LEAD,
            notes: data.notes || null,
            taxLien: { create: { auctionDate: data.auctionDate ? new Date(`${data.auctionDate}T12:00:00.000Z`) : null, maxBid: data.maxBid ? Number(data.maxBid) : null } },
          },
        })
        await tx.prePurchaseResearchSnapshot.update({ where: { id: data.researchSnapshotId }, data: { consumedDealId: created.id } })
        return created
      })
      await emitAuditEvent(tenant.id, 'DEAL_CREATED', { dealId: deal.id, strategy: 'TAX_LIEN', status: 'LEAD', researchSnapshotId: data.researchSnapshotId }, userId)
      dealId = deal.id
      redirect(`/dashboard/deals/${dealId}`)
    }

    const property = await db.property.upsert({
      where: { tenantId_apn_jurisdictionId: { tenantId: tenant.id, apn: data.apn, jurisdictionId: data.jurisdictionId } },
      update: { ...(data.address ? { address: data.address } : {}) },
      create: { tenantId: tenant.id, jurisdictionId: data.jurisdictionId, apn: data.apn, ...(data.address ? { address: data.address } : {}) },
    })

    if (data.status === 'LEAD') {
      const deal = await db.deal.create({
        data: {
          tenantId: tenant.id, propertyId: property.id,
          strategyType: StrategyType.TAX_LIEN, status: DealStatus.LEAD,
          notes: data.notes || null,
          taxLien: {
            create: {
              auctionDate: data.auctionDate ? new Date(`${data.auctionDate}T12:00:00.000Z`) : null,
              maxBid: (data.maxBid && data.maxBid !== '') ? Number(data.maxBid) : null,
            },
          },
        },
      })
      await emitAuditEvent(tenant.id, 'DEAL_CREATED', { dealId: deal.id, strategy: 'TAX_LIEN', status: 'LEAD' }, userId)
      dealId = deal.id
    } else {
      const d = data as z.infer<typeof ActiveSchema>
      const deal = await db.deal.create({
        data: {
          tenantId: tenant.id, propertyId: property.id,
          strategyType: StrategyType.TAX_LIEN, status: DealStatus.ACTIVE,
          notes: d.notes || null,
          taxLien: {
            create: {
              certificateNumber: d.certificateNumber,
              faceAmount: d.faceAmount,
              interestRate: d.interestRate / 100,
              issueDate: new Date(`${d.issueDate}T12:00:00.000Z`),
            },
          },
        },
      })
      await generateEventsForDeal(deal.id, tenant.id)
      await applyTenantWorkflowRules(tenant.id, deal.id)
      await emitAuditEvent(tenant.id, 'DEAL_CREATED', { dealId: deal.id, strategy: 'TAX_LIEN' }, userId)
      dealId = deal.id
    }
  } catch (err) {
    console.error('[createLien]', err)
    return { message: 'Failed to save. Please try again.' }
  }

  redirect(`/dashboard/deals/${dealId}`)
}

// ---------------------------------------------------------------------------
// convertToActive — LEAD → ACTIVE
// ---------------------------------------------------------------------------

export async function convertToActive(dealId: string, _prev: LienFormState, formData: FormData): Promise<LienFormState> {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return { message: 'Not authenticated.' }

  const tenant = await db.tenant.findUnique({ where: { clerkOrgId: orgId } })
  if (!tenant) return { message: 'Account not found.' }

  const parsed = ConvertSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors as Record<string, string[]> }

  const { certificateNumber, faceAmount, interestRate, issueDate, notes } = parsed.data

  try {
    const deal = await db.deal.findUnique({ where: { id: dealId, tenantId: tenant.id } })
    if (!deal) return { message: 'Lien not found.' }

    await db.dealTaxLien.update({
      where: { dealId },
      data: { certificateNumber, faceAmount, interestRate: interestRate / 100, issueDate: new Date(`${issueDate}T12:00:00.000Z`) },
    })

    await db.deal.update({
      where: { id: dealId },
      data: { status: DealStatus.ACTIVE, notes: notes || null },
    })

    await generateEventsForDeal(dealId, tenant.id)
  } catch (err) {
    console.error('[convertToActive]', err)
    return { message: 'Failed to convert. Please try again.' }
  }

  redirect(`/dashboard/deals/${dealId}`)
}

// ---------------------------------------------------------------------------
// updateLien
// ---------------------------------------------------------------------------

export async function updateLien(dealId: string, _prev: LienFormState, formData: FormData): Promise<LienFormState> {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return { message: 'Not authenticated.' }

  const tenant = await db.tenant.findUnique({ where: { clerkOrgId: orgId } })
  if (!tenant) return { message: 'Account not found.' }

  const parsed = UpdateLienSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors as Record<string, string[]> }

  const { jurisdictionId, apn, address, certificateNumber, faceAmount, interestRate, issueDate, notes } = parsed.data

  try {
    const deal = await db.deal.findUnique({ where: { id: dealId, tenantId: tenant.id } })
    if (!deal) return { message: 'Lien not found.' }

    // Upsert property — if jurisdiction or APN changed, this creates/finds the right record
    const property = await db.property.upsert({
      where: { tenantId_apn_jurisdictionId: { tenantId: tenant.id, apn, jurisdictionId } },
      update: { ...(address ? { address } : {}) },
      create: { tenantId: tenant.id, jurisdictionId, apn, ...(address ? { address } : {}) },
    })

    await db.deal.update({ where: { id: dealId }, data: { propertyId: property.id, notes: notes || null } })
    await db.dealTaxLien.update({
      where: { dealId },
      data: { certificateNumber, faceAmount, interestRate: interestRate / 100, issueDate: new Date(`${issueDate}T12:00:00.000Z`) },
    })
    await generateEventsForDeal(dealId, tenant.id)
  } catch (err) {
    console.error('[updateLien]', err)
    return { message: 'Failed to update. Please try again.' }
  }

  redirect(`/dashboard/deals/${dealId}`)
}

// ---------------------------------------------------------------------------
// createDeed — Tax Deed (lead or active)
// ---------------------------------------------------------------------------

export async function createDeed(_prev: LienFormState, formData: FormData): Promise<LienFormState> {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return { message: 'Not authenticated.' }

  const tenant = await db.tenant.findUnique({ where: { clerkOrgId: orgId } })
  if (!tenant) return { message: 'Account not found.' }
  if (!await hasStrategy(tenant.id, StrategyType.TAX_DEED)) return { message: 'Tax Deed strategy is not enabled for your account.' }

  const raw = Object.fromEntries(formData)
  const schema = raw.status === 'LEAD' ? DeedLeadSchema : DeedActiveSchema
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parsed = (schema as any).safeParse(raw)
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors }

  const data = parsed.data
  let dealId: string

  try {
    const property = await db.property.upsert({
      where: { tenantId_apn_jurisdictionId: { tenantId: tenant.id, apn: data.apn, jurisdictionId: data.jurisdictionId } },
      update: { ...(data.address ? { address: data.address } : {}) },
      create: { tenantId: tenant.id, jurisdictionId: data.jurisdictionId, apn: data.apn, ...(data.address ? { address: data.address } : {}) },
    })

    if (data.status === 'LEAD') {
      const deal = await db.deal.create({
        data: {
          tenantId: tenant.id, propertyId: property.id,
          strategyType: StrategyType.TAX_DEED, status: DealStatus.LEAD,
          notes: data.notes || null,
          taxDeed: {
            create: {
              auctionDate: data.auctionDate ? new Date(`${data.auctionDate}T12:00:00.000Z`) : null,
              maxBid: data.maxBid ? Number(data.maxBid) : null,
            },
          },
        },
      })
      await emitAuditEvent(tenant.id, 'DEAL_CREATED', { dealId: deal.id, strategy: 'TAX_DEED', status: 'LEAD' }, userId)
      dealId = deal.id
    } else {
      const d = data as z.infer<typeof DeedActiveSchema>
      const saleDateObj = new Date(`${d.saleDate}T12:00:00.000Z`)
      const redemptionDeadline = d.redemptionPeriodDays
        ? new Date(saleDateObj.getTime() + d.redemptionPeriodDays * 86_400_000)
        : null

      const deal = await db.deal.create({
        data: {
          tenantId: tenant.id, propertyId: property.id,
          strategyType: StrategyType.TAX_DEED, status: DealStatus.ACTIVE,
          notes: d.notes || null,
          taxDeed: {
            create: {
              saleDate: saleDateObj,
              openingBid: d.openingBid ? Number(d.openingBid) : null,
              winningBid: d.winningBid,
              redemptionPeriodDays: d.redemptionPeriodDays ?? null,
              redemptionDeadline,
            },
          },
        },
      })
      await generateEventsForDeal(deal.id, tenant.id)
      await emitAuditEvent(tenant.id, 'DEAL_CREATED', { dealId: deal.id, strategy: 'TAX_DEED' }, userId)
      dealId = deal.id
    }
  } catch (err) {
    console.error('[createDeed]', err)
    return { message: 'Failed to save. Please try again.' }
  }

  redirect(`/dashboard/deals/${dealId}`)
}

// ---------------------------------------------------------------------------
// createForeclosure — Foreclosure Auction (lead or active)
// ---------------------------------------------------------------------------

export async function createForeclosure(_prev: LienFormState, formData: FormData): Promise<LienFormState> {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return { message: 'Not authenticated.' }

  const tenant = await db.tenant.findUnique({ where: { clerkOrgId: orgId } })
  if (!tenant) return { message: 'Account not found.' }
  if (!await hasStrategy(tenant.id, StrategyType.FORECLOSURE)) return { message: 'Foreclosure strategy is not enabled for your account.' }

  const raw = Object.fromEntries(formData)
  const schema = raw.status === 'LEAD' ? ForeclosureLeadSchema : ForeclosureActiveSchema
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parsed = (schema as any).safeParse(raw)
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors }

  const data = parsed.data
  let dealId: string

  try {
    const property = await db.property.upsert({
      where: { tenantId_apn_jurisdictionId: { tenantId: tenant.id, apn: data.apn, jurisdictionId: data.jurisdictionId } },
      update: { ...(data.address ? { address: data.address } : {}) },
      create: { tenantId: tenant.id, jurisdictionId: data.jurisdictionId, apn: data.apn, ...(data.address ? { address: data.address } : {}) },
    })

    if (data.status === 'LEAD') {
      const deal = await db.deal.create({
        data: {
          tenantId: tenant.id, propertyId: property.id,
          strategyType: StrategyType.FORECLOSURE, status: DealStatus.LEAD,
          notes: data.notes || null,
          foreclosure: {
            create: {
              foreclosureType: data.foreclosureType,
              auctionDate: data.auctionDate ? new Date(`${data.auctionDate}T12:00:00.000Z`) : null,
              maxBid: data.maxBid ? Number(data.maxBid) : null,
              estimatedLiens: data.estimatedLiens ? Number(data.estimatedLiens) : null,
            },
          },
        },
      })
      await emitAuditEvent(tenant.id, 'DEAL_CREATED', { dealId: deal.id, strategy: 'FORECLOSURE', status: 'LEAD' }, userId)
      dealId = deal.id
    } else {
      const d = data as z.infer<typeof ForeclosureActiveSchema>
      const deal = await db.deal.create({
        data: {
          tenantId: tenant.id, propertyId: property.id,
          strategyType: StrategyType.FORECLOSURE, status: DealStatus.ACTIVE,
          notes: d.notes || null,
          foreclosure: {
            create: {
              foreclosureType: d.foreclosureType,
              auctionDate: new Date(`${d.auctionDate}T12:00:00.000Z`),
              openingBid: d.openingBid ? Number(d.openingBid) : null,
              winningBid: d.winningBid,
            },
          },
        },
      })
      await generateEventsForDeal(deal.id, tenant.id)
      await emitAuditEvent(tenant.id, 'DEAL_CREATED', { dealId: deal.id, strategy: 'FORECLOSURE' }, userId)
      dealId = deal.id
    }
  } catch (err) {
    console.error('[createForeclosure]', err)
    return { message: 'Failed to save. Please try again.' }
  }

  redirect(`/dashboard/deals/${dealId}`)
}

// ---------------------------------------------------------------------------
// markNotWon — LEAD → NOT_WON
// ---------------------------------------------------------------------------

export async function markNotWon(dealId: string, note: string | null): Promise<{ error?: string }> {
  const result = await getCurrentUser()
  if (!result) return { error: 'Not authenticated.' }
  const { tenant } = result

  try {
    const deal = await db.deal.findUnique({ where: { id: dealId, tenantId: tenant.id } })
    if (!deal) return { error: 'Deal not found.' }
    if (deal.status !== 'LEAD') return { error: 'Only Lead deals can be marked Not Won.' }

    await db.deal.update({
      where: { id: dealId },
      data: { status: 'NOT_WON' as DealStatus, notes: note || deal.notes || null },
    })
    return {}
  } catch (err) {
    console.error('[markNotWon]', err)
    return { error: 'Failed to update.' }
  }
}

// ---------------------------------------------------------------------------
// relistAsLead — NOT_WON → LEAD
// ---------------------------------------------------------------------------

export async function relistAsLead(dealId: string, auctionDate: string | null): Promise<{ error?: string }> {
  const result = await getCurrentUser()
  if (!result) return { error: 'Not authenticated.' }
  const { tenant } = result

  try {
    const deal = await db.deal.findUnique({
      where: { id: dealId, tenantId: tenant.id },
      include: { taxLien: true, taxDeed: true, foreclosure: true },
    })
    if (!deal) return { error: 'Deal not found.' }
    if ((deal.status as string) !== 'NOT_WON') return { error: 'Only Not Won deals can be re-listed.' }

    await db.deal.update({ where: { id: dealId }, data: { status: DealStatus.LEAD } })

    if (auctionDate) {
      const dateVal = new Date(`${auctionDate}T12:00:00.000Z`)
      if (deal.taxLien) await db.dealTaxLien.update({ where: { dealId }, data: { auctionDate: dateVal } })
      else if (deal.taxDeed) await db.dealTaxDeed.update({ where: { dealId }, data: { auctionDate: dateVal } })
      else if (deal.foreclosure) await db.dealForeclosure.update({ where: { dealId }, data: { auctionDate: dateVal } })
    }
    return {}
  } catch (err) {
    console.error('[relistAsLead]', err)
    return { error: 'Failed to re-list.' }
  }
}

// ---------------------------------------------------------------------------
// recordRedemption — writes redemptionAmount/Date to DealTaxLien AND creates
// a REDEMPTION_RECEIVED FinancialTransaction so the ledger stays in sync.
// ---------------------------------------------------------------------------

export async function recordRedemption(
  dealId: string,
  redemptionAmount: number,
  redemptionDate: Date | null,
): Promise<{ error?: string }> {
  const result = await getCurrentUser()
  if (!result) return { error: 'Not authenticated.' }
  const { tenant } = result

  try {
    const deal = await db.deal.findUnique({ where: { id: dealId, tenantId: tenant.id } })
    if (!deal) return { error: 'Deal not found.' }

    const dateVal = redemptionDate ?? new Date()

    await db.$transaction([
      db.dealTaxLien.update({
        where: { dealId },
        data: { redemptionAmount, redemptionDate: dateVal, isRedeemed: true },
      }),
      db.financialTransaction.create({
        data: {
          dealId,
          tenantId: tenant.id,
          type: 'REDEMPTION_RECEIVED',
          amount: redemptionAmount,
          date: dateVal,
          description: 'Redemption received',
        },
      }),
    ])

    return {}
  } catch (err) {
    console.error('[recordRedemption]', err)
    return { error: 'Failed to record redemption.' }
  }
}

// ---------------------------------------------------------------------------
// deleteLien
// ---------------------------------------------------------------------------

export async function deleteLien(dealId: string): Promise<{ error?: string }> {
  const result = await getCurrentUser()
  if (!result) return { error: 'Not authenticated.' }
  const { tenant, user } = result
  if (!hasRole(user.role, 'ANALYST')) return { error: 'Insufficient permissions.' }

  try {
    await db.deal.delete({ where: { id: dealId, tenantId: tenant.id } })
    return {}
  } catch (err) {
    console.error('[deleteLien]', err)
    return { error: 'Failed to delete.' }
  }
}
