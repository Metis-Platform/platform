'use server'

import { z } from 'zod'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { generateEventsForDeal } from '@/lib/rules-engine'
import { StrategyType, DealStatus } from '@/app/generated/prisma'

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const CreateLienSchema = z.object({
  jurisdictionId:    z.string().min(1, 'Jurisdiction is required'),
  apn:               z.string().min(1, 'APN is required').max(60),
  address:           z.string().max(200).optional(),
  certificateNumber: z.string().min(1, 'Certificate number is required').max(60),
  faceAmount:        z.coerce.number({ error: 'Must be a number' }).positive('Must be greater than 0'),
  interestRate:      z.coerce.number({ error: 'Must be a number' }).min(0, 'Must be 0 or greater').max(100, 'Must be 100 or less'),
  issueDate:         z.string().min(1, 'Issue date is required'),
  notes:             z.string().max(2000).optional(),
})

// Edit only allows updating certificate details — jurisdiction and APN are fixed
const UpdateLienSchema = z.object({
  certificateNumber: z.string().min(1, 'Certificate number is required').max(60),
  faceAmount:        z.coerce.number({ error: 'Must be a number' }).positive('Must be greater than 0'),
  interestRate:      z.coerce.number({ error: 'Must be a number' }).min(0, 'Must be 0 or greater').max(100, 'Must be 100 or less'),
  issueDate:         z.string().min(1, 'Issue date is required'),
  notes:             z.string().max(2000).optional(),
})

export type LienFormState = {
  errors?: Record<string, string[]>
  message?: string
}

// ---------------------------------------------------------------------------
// createLien
// ---------------------------------------------------------------------------

export async function createLien(
  _prevState: LienFormState,
  formData: FormData,
): Promise<LienFormState> {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return { message: 'Not authenticated. Please sign in.' }

  const tenant = await db.tenant.findUnique({ where: { clerkOrgId: orgId } })
  if (!tenant) return { message: 'Account not found. Please reload the page.' }

  const parsed = CreateLienSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as Record<string, string[]> }
  }

  const { jurisdictionId, apn, address, certificateNumber, faceAmount, interestRate, issueDate, notes } = parsed.data

  let dealId: string
  try {
    const property = await db.property.upsert({
      where: { tenantId_apn_jurisdictionId: { tenantId: tenant.id, apn, jurisdictionId } },
      update: { ...(address ? { address } : {}) },
      create: { tenantId: tenant.id, jurisdictionId, apn, ...(address ? { address } : {}) },
    })

    const deal = await db.deal.create({
      data: {
        tenantId:     tenant.id,
        propertyId:   property.id,
        strategyType: StrategyType.TAX_LIEN,
        status:       DealStatus.ACTIVE,
        notes:        notes || null,
        taxLien: {
          create: {
            certificateNumber,
            faceAmount,
            interestRate: interestRate / 100,
            issueDate: new Date(`${issueDate}T12:00:00.000Z`),
          },
        },
      },
    })

    await generateEventsForDeal(deal.id, tenant.id)
    dealId = deal.id
  } catch (err) {
    console.error('[createLien] error:', err)
    return { message: 'Failed to save lien. Please try again.' }
  }

  redirect(`/dashboard/liens/${dealId}`)
}

// ---------------------------------------------------------------------------
// updateLien — bound as updateLien.bind(null, dealId)
// ---------------------------------------------------------------------------

export async function updateLien(
  dealId: string,
  _prevState: LienFormState,
  formData: FormData,
): Promise<LienFormState> {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return { message: 'Not authenticated.' }

  const tenant = await db.tenant.findUnique({ where: { clerkOrgId: orgId } })
  if (!tenant) return { message: 'Account not found.' }

  const parsed = UpdateLienSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as Record<string, string[]> }
  }

  const { certificateNumber, faceAmount, interestRate, issueDate, notes } = parsed.data

  try {
    // Confirm deal belongs to this tenant before updating
    const deal = await db.deal.findUnique({ where: { id: dealId, tenantId: tenant.id } })
    if (!deal) return { message: 'Lien not found.' }

    await db.dealTaxLien.update({
      where: { dealId },
      data: {
        certificateNumber,
        faceAmount,
        interestRate: interestRate / 100,
        issueDate: new Date(`${issueDate}T12:00:00.000Z`),
      },
    })

    // Update notes on the deal
    await db.deal.update({ where: { id: dealId }, data: { notes: notes || null } })

    // Regenerate events — issue date may have changed
    await generateEventsForDeal(dealId, tenant.id)
  } catch (err) {
    console.error('[updateLien] error:', err)
    return { message: 'Failed to update lien. Please try again.' }
  }

  redirect(`/dashboard/liens/${dealId}`)
}

// ---------------------------------------------------------------------------
// deleteLien — called directly from client component (no redirect)
// ---------------------------------------------------------------------------

export async function deleteLien(dealId: string): Promise<{ error?: string }> {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return { error: 'Not authenticated.' }

  const tenant = await db.tenant.findUnique({ where: { clerkOrgId: orgId } })
  if (!tenant) return { error: 'Account not found.' }

  try {
    await db.deal.delete({ where: { id: dealId, tenantId: tenant.id } })
    return {}
  } catch (err) {
    console.error('[deleteLien] error:', err)
    return { error: 'Failed to delete. Please try again.' }
  }
}
