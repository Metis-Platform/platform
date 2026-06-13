'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { auth } from '@clerk/nextjs/server'
import { syncUserToDatabase } from '@/lib/sync-user'
import { db } from '@/lib/db'
import { generateFixFlipEvents } from '@/lib/fix-flip-events'

export type FixFlipFormState = {
  error?: string
  fieldErrors?: Record<string, string>
}

function parseDate(val: string | null): Date | null {
  if (!val) return null
  const d = new Date(val)
  return isNaN(d.getTime()) ? null : d
}

function parseDec(val: string | null): number | null {
  if (!val) return null
  const n = parseFloat(val)
  return isNaN(n) ? null : n
}

function fd(formData: FormData, key: string): string | null {
  return (formData.get(key) as string)?.trim() || null
}

export async function createFixFlip(
  _prev: FixFlipFormState,
  formData: FormData,
): Promise<FixFlipFormState> {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return { error: 'Not authenticated' }
  const synced = await syncUserToDatabase()
  if (!synced) return { error: 'Tenant not found' }
  const { tenant } = synced

  const apn          = fd(formData, 'apn')
  const address      = fd(formData, 'address')
  const jurisdictionId = fd(formData, 'jurisdictionId')

  if (!apn)            return { fieldErrors: { apn: 'APN is required' } }
  if (!jurisdictionId) return { fieldErrors: { jurisdictionId: 'Jurisdiction is required' } }

  const purchasePrice = parseDec(fd(formData, 'purchasePrice'))
  const purchaseDate  = parseDate(fd(formData, 'purchaseDate'))
  const arv           = parseDec(fd(formData, 'arv'))
  const rehabBudget   = parseDec(fd(formData, 'rehabBudget'))
  const holdingCostEstimate = parseDec(fd(formData, 'holdingCostEstimate'))
  const rehabStartDate = parseDate(fd(formData, 'rehabStartDate'))
  const rehabTargetCompletion = parseDate(fd(formData, 'rehabTargetCompletion'))
  const listingDate   = parseDate(fd(formData, 'listingDate'))
  const listingPrice  = parseDec(fd(formData, 'listingPrice'))
  const closingDate   = parseDate(fd(formData, 'closingDate'))
  const contractorName = fd(formData, 'contractorName')
  const contractorPhone = fd(formData, 'contractorPhone')
  const contractorEmail = fd(formData, 'contractorEmail')
  const permitStatus  = fd(formData, 'permitStatus')
  const notes         = fd(formData, 'notes')

  const dealStatus = purchaseDate ? 'ACTIVE' : 'LEAD'

  const jur = await db.jurisdiction.findUnique({ where: { id: jurisdictionId } })
  if (!jur) return { fieldErrors: { jurisdictionId: 'Jurisdiction not found' } }

  const property = await db.property.create({
    data: {
      tenantId: tenant.id,
      apn,
      address,
      jurisdictionId,
    },
  })

  const deal = await db.deal.create({
    data: {
      tenantId: tenant.id,
      propertyId: property.id,
      strategyType: 'FIX_FLIP',
      status: dealStatus,
      purchasePrice,
      purchaseDate,
      notes,
      fixFlip: {
        create: {
          arv,
          rehabBudget,
          holdingCostEstimate,
          rehabStartDate,
          rehabTargetCompletion,
          listingDate,
          listingPrice,
          closingDate,
          contractorName,
          contractorPhone,
          contractorEmail,
          permitStatus,
        },
      },
    },
  })

  await generateFixFlipEvents(deal.id)
  redirect(`/dashboard/deals/${deal.id}`)
}

export async function updateFixFlip(
  dealId: string,
  _prev: FixFlipFormState,
  formData: FormData,
): Promise<FixFlipFormState> {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return { error: 'Not authenticated' }
  const synced = await syncUserToDatabase()
  if (!synced) return { error: 'Tenant not found' }
  const { tenant } = synced

  const deal = await db.deal.findUnique({ where: { id: dealId, tenantId: tenant.id } })
  if (!deal) return { error: 'Deal not found' }

  const purchasePrice = parseDec(fd(formData, 'purchasePrice'))
  const purchaseDate  = parseDate(fd(formData, 'purchaseDate'))
  const arv           = parseDec(fd(formData, 'arv'))
  const rehabBudget   = parseDec(fd(formData, 'rehabBudget'))
  const rehabActualCost = parseDec(fd(formData, 'rehabActualCost'))
  const holdingCostEstimate = parseDec(fd(formData, 'holdingCostEstimate'))
  const rehabStartDate = parseDate(fd(formData, 'rehabStartDate'))
  const rehabTargetCompletion = parseDate(fd(formData, 'rehabTargetCompletion'))
  const rehabCompletedDate = parseDate(fd(formData, 'rehabCompletedDate'))
  const listingDate   = parseDate(fd(formData, 'listingDate'))
  const listingPrice  = parseDec(fd(formData, 'listingPrice'))
  const acceptedOfferDate = parseDate(fd(formData, 'acceptedOfferDate'))
  const acceptedOfferPrice = parseDec(fd(formData, 'acceptedOfferPrice'))
  const closingDate   = parseDate(fd(formData, 'closingDate'))
  const contractorName = fd(formData, 'contractorName')
  const contractorPhone = fd(formData, 'contractorPhone')
  const contractorEmail = fd(formData, 'contractorEmail')
  const permitStatus  = fd(formData, 'permitStatus')
  const notes         = fd(formData, 'notes')

  await db.$transaction(async tx => {
    await tx.deal.update({
      where: { id: dealId },
      data: { purchasePrice, purchaseDate, notes },
    })
    await tx.dealFixFlip.upsert({
      where: { dealId },
      create: {
        dealId,
        arv,
        rehabBudget,
        rehabActualCost,
        holdingCostEstimate,
        rehabStartDate,
        rehabTargetCompletion,
        rehabCompletedDate,
        listingDate,
        listingPrice,
        acceptedOfferDate,
        acceptedOfferPrice,
        closingDate,
        contractorName,
        contractorPhone,
        contractorEmail,
        permitStatus,
      },
      update: {
        arv,
        rehabBudget,
        rehabActualCost,
        holdingCostEstimate,
        rehabStartDate,
        rehabTargetCompletion,
        rehabCompletedDate,
        listingDate,
        listingPrice,
        acceptedOfferDate,
        acceptedOfferPrice,
        closingDate,
        contractorName,
        contractorPhone,
        contractorEmail,
        permitStatus,
      },
    })
  })

  await generateFixFlipEvents(dealId)
  revalidatePath(`/dashboard/deals/${dealId}`)
  redirect(`/dashboard/deals/${dealId}`)
}
