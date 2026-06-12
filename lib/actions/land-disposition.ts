'use server'

import { z } from 'zod'
import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import type { LandDispositionStatus } from '@/app/generated/prisma'

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
    })
  } catch (err) {
    console.error('[updateLandDisposition]', err)
    return { message: 'Failed to update disposition. Please try again.' }
  }

  revalidatePath(`/dashboard/deals/${dealId}`)
  return {}
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function defaultLandNote(
  dealId: string,
  noteId: string,
  _prev: DispositionFormState,
  _formData: FormData,
): Promise<DispositionFormState> {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return { message: 'Not authenticated.' }

  const tenant = await db.tenant.findUnique({ where: { clerkOrgId: orgId } })
  if (!tenant) return { message: 'Account not found.' }

  const note = await db.landNote.findUnique({ where: { id: noteId, tenantId: tenant.id } })
  if (!note) return { message: 'Note not found.' }
  if (note.status !== 'ACTIVE') return { message: 'Note is not active.' }

  try {
    await db.$transaction(async (tx) => {
      await tx.landNote.update({ where: { id: noteId }, data: { status: 'DEFAULTED' } })
      await tx.dealLand.update({
        where: { dealId },
        data: { dispositionStatus: 'RELISTED', dispositionDate: new Date() },
      })
      await tx.deal.update({ where: { id: dealId }, data: { status: 'ACTIVE' } })
    })
  } catch (err) {
    console.error('[defaultLandNote]', err)
    return { message: 'Failed to record default. Please try again.' }
  }

  revalidatePath(`/dashboard/deals/${dealId}`)
  return {}
}
