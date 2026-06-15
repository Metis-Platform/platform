'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { auth } from '@clerk/nextjs/server'
import { syncUserToDatabase } from '@/lib/sync-user'
import { db } from '@/lib/db'
import type { ContactType, ContactPipelineStage, ContactActivityType } from '@/app/generated/prisma'

export type ContactFormState = {
  error?: string
  fieldErrors?: Record<string, string>
}

export async function createContact(
  _prev: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return { error: 'Not authenticated' }
  const synced = await syncUserToDatabase()
  if (!synced) return { error: 'Tenant not found' }
  const { tenant } = synced

  const firstName = (formData.get('firstName') as string)?.trim() || null
  const lastName = (formData.get('lastName') as string)?.trim() || null
  const company = (formData.get('company') as string)?.trim() || null

  if (!firstName && !lastName && !company) {
    return { error: 'Enter a name or company' }
  }

  const type = (formData.get('type') as ContactType) || 'OTHER'
  const pipelineStage = (formData.get('pipelineStage') as ContactPipelineStage) || 'LEAD'
  const email = (formData.get('email') as string)?.trim() || null
  const phone = (formData.get('phone') as string)?.trim() || null
  const address = (formData.get('address') as string)?.trim() || null
  const city = (formData.get('city') as string)?.trim() || null
  const state = (formData.get('state') as string)?.trim() || null
  const zip = (formData.get('zip') as string)?.trim() || null
  const notes = (formData.get('notes') as string)?.trim() || null

  const contact = await db.contact.create({
    data: { tenantId: tenant.id, type, pipelineStage, firstName, lastName, company, email, phone, address, city, state, zip, notes },
  })

  redirect(`/dashboard/contacts/${contact.id}`)
}

export async function updateContact(
  contactId: string,
  _prev: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return { error: 'Not authenticated' }
  const synced = await syncUserToDatabase()
  if (!synced) return { error: 'Tenant not found' }
  const { tenant } = synced

  const existing = await db.contact.findUnique({ where: { id: contactId, tenantId: tenant.id } })
  if (!existing) return { error: 'Contact not found' }

  const firstName = (formData.get('firstName') as string)?.trim() || null
  const lastName = (formData.get('lastName') as string)?.trim() || null
  const company = (formData.get('company') as string)?.trim() || null

  if (!firstName && !lastName && !company) {
    return { error: 'Enter a name or company' }
  }

  const type = (formData.get('type') as ContactType) || existing.type
  const pipelineStage = (formData.get('pipelineStage') as ContactPipelineStage) || existing.pipelineStage
  const email = (formData.get('email') as string)?.trim() || null
  const phone = (formData.get('phone') as string)?.trim() || null
  const address = (formData.get('address') as string)?.trim() || null
  const city = (formData.get('city') as string)?.trim() || null
  const state = (formData.get('state') as string)?.trim() || null
  const zip = (formData.get('zip') as string)?.trim() || null
  const notes = (formData.get('notes') as string)?.trim() || null

  await db.contact.update({
    where: { id: contactId },
    data: { type, pipelineStage, firstName, lastName, company, email, phone, address, city, state, zip, notes },
  })

  revalidatePath(`/dashboard/contacts/${contactId}`)
  revalidatePath('/dashboard/contacts')
  redirect(`/dashboard/contacts/${contactId}`)
}

export async function deleteContact(
  contactId: string,
  _prev: ContactFormState,
  _formData: FormData,
): Promise<ContactFormState> {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return { error: 'Not authenticated' }
  const synced = await syncUserToDatabase()
  if (!synced) return { error: 'Tenant not found' }
  const { tenant } = synced

  const existing = await db.contact.findUnique({ where: { id: contactId, tenantId: tenant.id } })
  if (!existing) return { error: 'Contact not found' }

  await db.contact.delete({ where: { id: contactId } })

  revalidatePath('/dashboard/contacts')
  redirect('/dashboard/contacts')
}

export async function logActivity(
  contactId: string,
  _prev: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return { error: 'Not authenticated' }
  const synced = await syncUserToDatabase()
  if (!synced) return { error: 'Tenant not found' }
  const { tenant } = synced

  const contact = await db.contact.findUnique({ where: { id: contactId, tenantId: tenant.id } })
  if (!contact) return { error: 'Contact not found' }

  const type = (formData.get('type') as ContactActivityType) || 'NOTE'
  const notes = (formData.get('notes') as string)?.trim() || null
  const occurredAtRaw = (formData.get('occurredAt') as string)?.trim()
  const occurredAt = occurredAtRaw ? new Date(occurredAtRaw) : new Date()

  await db.contactActivity.create({
    data: { contactId, tenantId: tenant.id, type, notes, occurredAt },
  })

  revalidatePath(`/dashboard/contacts/${contactId}`)
  return {}
}

export async function deleteActivity(
  contactId: string,
  activityId: string,
  _prev: ContactFormState,
  _formData: FormData,
): Promise<ContactFormState> {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return { error: 'Not authenticated' }
  const synced = await syncUserToDatabase()
  if (!synced) return { error: 'Tenant not found' }
  const { tenant } = synced

  const activity = await db.contactActivity.findUnique({ where: { id: activityId, tenantId: tenant.id } })
  if (!activity || activity.contactId !== contactId) return { error: 'Activity not found' }

  await db.contactActivity.delete({ where: { id: activityId } })

  revalidatePath(`/dashboard/contacts/${contactId}`)
  return {}
}
