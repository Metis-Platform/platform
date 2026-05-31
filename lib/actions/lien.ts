'use server'

import { z } from 'zod'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { generateEventsForDeal } from '@/lib/rules-engine'
import { getCurrentUser, hasRole } from '@/lib/auth'
import { StrategyType, DealStatus } from '@/app/generated/prisma'

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

  const { certificateNumber, faceAmount, interestRate, issueDate, notes } = parsed.data

  try {
    const deal = await db.deal.findUnique({ where: { id: dealId, tenantId: tenant.id } })
    if (!deal) return { message: 'Lien not found.' }

    await db.dealTaxLien.update({
      where: { dealId },
      data: { certificateNumber, faceAmount, interestRate: interestRate / 100, issueDate: new Date(`${issueDate}T12:00:00.000Z`) },
    })
    await db.deal.update({ where: { id: dealId }, data: { notes: notes || null } })
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
      dealId = deal.id
    }
  } catch (err) {
    console.error('[createForeclosure]', err)
    return { message: 'Failed to save. Please try again.' }
  }

  redirect(`/dashboard/deals/${dealId}`)
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
