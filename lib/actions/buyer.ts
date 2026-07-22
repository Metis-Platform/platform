'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { auth } from '@clerk/nextjs/server'
import { syncUserToDatabase } from '@/lib/sync-user'
import { db } from '@/lib/db'
import { requestIdFromHeaders } from '@/lib/request-correlation'

export type BuyerFormState = {
  error?: string
  fieldErrors?: Record<string, string>
}

export async function createBuyer(_prev: BuyerFormState, formData: FormData): Promise<BuyerFormState> {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return { error: 'Not authenticated' }
  const synced = await syncUserToDatabase()
  if (!synced) return { error: 'Tenant not found' }
  const { tenant } = synced

  const firstName = (formData.get('firstName') as string)?.trim() || null
  const lastName = (formData.get('lastName') as string)?.trim() || null
  const company = (formData.get('company') as string)?.trim() || null
  const email = (formData.get('email') as string)?.trim() || null
  const phone = (formData.get('phone') as string)?.trim() || null

  if (!firstName && !lastName && !company) {
    return { error: 'Enter a name or company' }
  }

  const priceMinRaw = (formData.get('priceMin') as string)?.trim()
  const priceMaxRaw = (formData.get('priceMax') as string)?.trim()
  const feeMaxRaw = (formData.get('assignmentFeeMax') as string)?.trim()
  const statesRaw = (formData.get('preferredStates') as string)?.trim()
  const propTypesRaw = (formData.get('preferredPropTypes') as string)?.trim()
  const notes = (formData.get('profileNotes') as string)?.trim() || null

  const preferredStates = statesRaw
    ? statesRaw.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
    : []
  const preferredPropTypes = propTypesRaw
    ? propTypesRaw.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
    : []
  const requestId = requestIdFromHeaders(await headers())

  await db.$transaction(async tx => {
    const contact = await tx.contact.create({
      data: {
        tenantId: tenant.id,
        type: 'BUYER',
        firstName,
        lastName,
        company,
        email,
        phone,
      },
    })
    await tx.buyerProfile.create({
      data: {
        contactId: contact.id,
        tenantId: tenant.id,
        priceMin: priceMinRaw ? parseFloat(priceMinRaw) : null,
        priceMax: priceMaxRaw ? parseFloat(priceMaxRaw) : null,
        assignmentFeeMax: feeMaxRaw ? parseFloat(feeMaxRaw) : null,
        preferredStates,
        preferredPropTypes,
        notes,
      },
    })
    await tx.auditEvent.create({
      data: {
        tenantId: tenant.id,
        userId: synced.user.id,
        requestId,
        action: 'BUYER_PROFILE_CREATED',
        meta: { contactId: contact.id },
      },
    })
  })

  redirect('/dashboard/buyers')
}

export async function updateBuyerProfile(
  contactId: string,
  _prev: BuyerFormState,
  formData: FormData,
): Promise<BuyerFormState> {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return { error: 'Not authenticated' }
  const synced = await syncUserToDatabase()
  if (!synced) return { error: 'Tenant not found' }
  const { tenant } = synced

  const existing = await db.contact.findUnique({
    where: { id: contactId, tenantId: tenant.id },
  })
  if (!existing) return { error: 'Buyer not found' }

  const firstName = (formData.get('firstName') as string)?.trim() || null
  const lastName = (formData.get('lastName') as string)?.trim() || null
  const company = (formData.get('company') as string)?.trim() || null
  const email = (formData.get('email') as string)?.trim() || null
  const phone = (formData.get('phone') as string)?.trim() || null

  const priceMinRaw = (formData.get('priceMin') as string)?.trim()
  const priceMaxRaw = (formData.get('priceMax') as string)?.trim()
  const feeMaxRaw = (formData.get('assignmentFeeMax') as string)?.trim()
  const statesRaw = (formData.get('preferredStates') as string)?.trim()
  const propTypesRaw = (formData.get('preferredPropTypes') as string)?.trim()
  const notes = (formData.get('profileNotes') as string)?.trim() || null
  const isActive = formData.get('isActive') === 'true'

  const preferredStates = statesRaw
    ? statesRaw.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
    : []
  const preferredPropTypes = propTypesRaw
    ? propTypesRaw.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
    : []
  const requestId = requestIdFromHeaders(await headers())

  await db.$transaction(async tx => {
    await tx.contact.update({
      where: { id: contactId },
      data: { firstName, lastName, company, email, phone },
    })
    await tx.buyerProfile.upsert({
      where: { contactId },
      create: {
        contactId,
        tenantId: tenant.id,
        priceMin: priceMinRaw ? parseFloat(priceMinRaw) : null,
        priceMax: priceMaxRaw ? parseFloat(priceMaxRaw) : null,
        assignmentFeeMax: feeMaxRaw ? parseFloat(feeMaxRaw) : null,
        preferredStates,
        preferredPropTypes,
        isActive,
        notes,
      },
      update: {
        priceMin: priceMinRaw ? parseFloat(priceMinRaw) : null,
        priceMax: priceMaxRaw ? parseFloat(priceMaxRaw) : null,
        assignmentFeeMax: feeMaxRaw ? parseFloat(feeMaxRaw) : null,
        preferredStates,
        preferredPropTypes,
        isActive,
        notes,
      },
    })
    await tx.auditEvent.create({
      data: {
        tenantId: tenant.id,
        userId: synced.user.id,
        requestId,
        action: 'BUYER_PROFILE_UPDATED',
        meta: { contactId },
      },
    })
  })

  revalidatePath(`/dashboard/buyers/${contactId}`)
  revalidatePath('/dashboard/buyers')
  redirect(`/dashboard/buyers/${contactId}`)
}

export async function linkBuyerToDeal(
  dealId: string,
  contactId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _prev: BuyerFormState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData,
): Promise<BuyerFormState> {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return { error: 'Not authenticated' }
  const synced = await syncUserToDatabase()
  if (!synced) return { error: 'Tenant not found' }
  const { tenant } = synced

  const deal = await db.deal.findUnique({ where: { id: dealId, tenantId: tenant.id } })
  if (!deal) return { error: 'Deal not found' }
  const buyer = await db.contact.findFirst({
    where: { id: contactId, tenantId: tenant.id, type: 'BUYER' },
    select: { id: true },
  })
  if (!buyer) return { error: 'Buyer not found' }
  const requestId = requestIdFromHeaders(await headers())

  await db.$transaction(async tx => {
    await tx.dealWholesale.update({
      where: { dealId },
      data: { buyerContactId: buyer.id },
    })
    await tx.auditEvent.create({
      data: {
        tenantId: tenant.id,
        userId: synced.user.id,
        requestId,
        action: 'BUYER_LINKED_TO_DEAL',
        meta: { dealId, contactId: buyer.id },
      },
    })
  })

  revalidatePath(`/dashboard/deals/${dealId}`)
  return {}
}

export async function unlinkBuyerFromDeal(
  dealId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _prev: BuyerFormState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData,
): Promise<BuyerFormState> {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return { error: 'Not authenticated' }
  const synced = await syncUserToDatabase()
  if (!synced) return { error: 'Tenant not found' }
  const { tenant } = synced

  const deal = await db.deal.findUnique({ where: { id: dealId, tenantId: tenant.id } })
  if (!deal) return { error: 'Deal not found' }
  const wholesale = await db.dealWholesale.findUnique({
    where: { dealId },
    select: { buyerContactId: true },
  })
  if (!wholesale?.buyerContactId) return {}
  const requestId = requestIdFromHeaders(await headers())

  await db.$transaction(async tx => {
    await tx.dealWholesale.update({
      where: { dealId },
      data: { buyerContactId: null },
    })
    await tx.auditEvent.create({
      data: {
        tenantId: tenant.id,
        userId: synced.user.id,
        requestId,
        action: 'BUYER_UNLINKED_FROM_DEAL',
        meta: { dealId, contactId: wholesale.buyerContactId },
      },
    })
  })

  revalidatePath(`/dashboard/deals/${dealId}`)
  return {}
}
