'use server'

import { z } from 'zod'
import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { db } from '@/lib/db'
import type { LandDispositionStatus } from '@/app/generated/prisma'
import { hasStrategy } from '@/lib/entitlements'
import { requestIdFromHeaders } from '@/lib/request-correlation'

export type DispositionFormState = { errors?: Record<string, string[]>; message?: string }

const SOLD_STATUSES: LandDispositionStatus[] = ['SOLD_CASH', 'SOLD_TERMS']

const UpdateSchema = z.object({
  targetStatus: z.enum(['LISTED', 'UNDER_CONTRACT', 'SOLD_CASH', 'SOLD_TERMS', 'RELISTED']),
  listedPrice:  z.coerce.number().positive().optional().or(z.literal('')).transform(v => v === '' ? undefined : v),
})

export async function updateLandDisposition(
  dealId: string,
  _prev: DispositionFormState,
  formData: FormData,
): Promise<DispositionFormState> {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return { message: 'Not authenticated.' }

  const tenant = await db.tenant.findUnique({ where: { clerkOrgId: orgId } })
  if (!tenant) return { message: 'Account not found.' }
  if (!await hasStrategy(tenant.id, 'LAND')) return { message: 'Land strategy is not enabled for your account.' }

  const parsed = UpdateSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors as Record<string, string[]> }

  const deal = await db.deal.findUnique({
    where: { id: dealId, tenantId: tenant.id },
    select: { id: true, status: true },
  })
  if (!deal) return { message: 'Deal not found.' }

  const { targetStatus, listedPrice } = parsed.data
  const isSold = SOLD_STATUSES.includes(targetStatus as LandDispositionStatus)
  const isRelisted = targetStatus === 'RELISTED'
  const requestId = requestIdFromHeaders(await headers())

  try {
    await db.$transaction(async (tx) => {
      await tx.dealLand.update({
        where: { dealId },
        data: {
          dispositionStatus: targetStatus as LandDispositionStatus,
          ...(listedPrice !== undefined ? { listedPrice } : {}),
          ...(isSold || isRelisted ? { dispositionDate: new Date() } : {}),
        },
      })

      if (isSold && deal.status !== 'SOLD') {
        await tx.deal.update({ where: { id: dealId }, data: { status: 'SOLD' } })
      } else if (isRelisted && deal.status === 'SOLD') {
        await tx.deal.update({ where: { id: dealId }, data: { status: 'ACTIVE' } })
      }
      await tx.auditEvent.create({
        data: {
          tenantId: tenant.id,
          userId,
          requestId,
          action: 'LAND_DISPOSITION_UPDATED',
          meta: { dealId },
        },
      })
    })
  } catch (err) {
    console.error('[updateLandDisposition]', err)
    return { message: 'Failed to update disposition. Please try again.' }
  }

  revalidatePath(`/dashboard/deals/${dealId}`)
  return {}
}

export async function defaultLandNote(
  dealId: string,
  noteId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _prev: DispositionFormState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData,
): Promise<DispositionFormState> {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return { message: 'Not authenticated.' }

  const tenant = await db.tenant.findUnique({ where: { clerkOrgId: orgId } })
  if (!tenant) return { message: 'Account not found.' }

  const note = await db.landNote.findFirst({ where: { id: noteId, dealId, tenantId: tenant.id } })
  if (!note) return { message: 'Note not found.' }
  if (note.status !== 'ACTIVE') return { message: 'Note is not active.' }
  const requestId = requestIdFromHeaders(await headers())

  try {
    await db.$transaction(async (tx) => {
      await tx.landNote.update({ where: { id: noteId }, data: { status: 'DEFAULTED' } })
      await tx.dealLand.update({
        where: { dealId },
        data: { dispositionStatus: 'RELISTED', dispositionDate: new Date() },
      })
      await tx.deal.update({ where: { id: dealId }, data: { status: 'ACTIVE' } })
      await tx.auditEvent.create({
        data: {
          tenantId: tenant.id,
          userId,
          requestId,
          action: 'LAND_NOTE_DEFAULTED',
          meta: { dealId, noteId },
        },
      })
    })
  } catch (err) {
    console.error('[defaultLandNote]', err)
    return { message: 'Failed to record default. Please try again.' }
  }

  revalidatePath(`/dashboard/deals/${dealId}`)
  return {}
}
