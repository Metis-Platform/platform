'use server'

import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { syncUserToDatabase } from '@/lib/sync-user'
import { revalidatePath } from 'next/cache'
import { EventStatus } from '@/app/generated/prisma'

export async function updateEvent(
  eventId: string,
  data: {
    status?: string
    dueDate?: string
    notes?: string | null
    completedDate?: string | null
  }
) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) throw new Error('Unauthorized')

  const synced = await syncUserToDatabase()
  if (!synced) throw new Error('Tenant not found')
  const { tenant } = synced

  const event = await db.event.findFirst({
    where: { id: eventId, deal: { tenantId: tenant.id } },
    select: { id: true, dealId: true },
  })
  if (!event) throw new Error('Event not found or access denied')

  await db.event.update({
    where: { id: eventId },
    data: {
      ...(data.status && { status: data.status as EventStatus }),
      ...(data.dueDate && { dueDate: new Date(data.dueDate) }),
      ...(data.notes !== undefined && { notes: data.notes || null }),
      ...(data.completedDate !== undefined && {
        completedDate: data.completedDate ? new Date(data.completedDate) : null,
      }),
    },
  })

  revalidatePath('/dashboard/calendar')
  revalidatePath(`/dashboard/deals/${event.dealId}`)
}
