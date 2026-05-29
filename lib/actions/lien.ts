'use server'

import { z } from 'zod'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { generateEventsForDeal } from '@/lib/rules-engine'
import { StrategyType, DealStatus } from '@/app/generated/prisma'

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------

const CreateLienSchema = z.object({
  jurisdictionId:    z.string().min(1, 'Jurisdiction is required'),
  apn:               z.string().min(1, 'APN is required').max(60),
  address:           z.string().max(200).optional(),
  certificateNumber: z.string().min(1, 'Certificate number is required').max(60),
  faceAmount:        z.coerce.number({ error: 'Must be a number' }).positive('Must be greater than 0'),
  interestRate:      z.coerce.number({ error: 'Must be a number' }).min(0).max(100),
  issueDate:         z.string().min(1, 'Issue date is required'),
  notes:             z.string().max(2000).optional(),
})

export type CreateLienFormState = {
  errors?: Record<string, string[]>
  message?: string
}

// ---------------------------------------------------------------------------
// Server action
// ---------------------------------------------------------------------------

export async function createLien(
  _prevState: CreateLienFormState,
  formData: FormData,
): Promise<CreateLienFormState> {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return { message: 'Not authenticated. Please sign in.' }

  const tenant = await db.tenant.findUnique({ where: { clerkOrgId: orgId } })
  if (!tenant) return { message: 'Account not found. Please reload the page.' }

  const raw = Object.fromEntries(formData)
  const parsed = CreateLienSchema.safeParse(raw)
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as Record<string, string[]> }
  }

  const { jurisdictionId, apn, address, certificateNumber, faceAmount, interestRate, issueDate, notes } = parsed.data

  let dealId: string
  try {
    // Upsert property — same APN + jurisdiction + tenant = same physical property
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
            interestRate: interestRate / 100, // store as decimal: 18% → 0.18
            // Append T12:00:00Z so the date is stored as noon UTC regardless of timezone
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

  // redirect() must be outside try/catch — it throws internally (NEXT_REDIRECT)
  redirect(`/dashboard/liens?created=${dealId}`)
}
