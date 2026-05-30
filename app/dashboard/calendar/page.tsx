import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { syncUserToDatabase } from '@/lib/sync-user'
import { db } from '@/lib/db'
import CalendarClient from './CalendarClient'

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>
}) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) redirect('/sign-in')

  const synced = await syncUserToDatabase()
  if (!synced) redirect('/onboarding')
  const { tenant } = synced

  const params = await searchParams
  const now = new Date()
  const year = params.year ? parseInt(params.year) : now.getFullYear()
  const month = params.month ? parseInt(params.month) : now.getMonth()

  const start = new Date(year, month, 1)
  const end = new Date(year, month + 1, 0, 23, 59, 59)

  const [events, tasks] = await Promise.all([
    db.event.findMany({
      where: { deal: { tenantId: tenant.id }, dueDate: { gte: start, lte: end } },
      include: { deal: { include: { property: true } } },
      orderBy: { dueDate: 'asc' },
    }),
    db.task.findMany({
      where: {
        tenantId: tenant.id,
        dueDate: { gte: start, lte: end },
        status: { not: 'CANCELLED' },
      },
      include: { deal: { include: { property: true } } },
      orderBy: { dueDate: 'asc' },
    }),
  ])

  return (
    <CalendarClient
      year={year}
      month={month}
      events={events.map(e => ({
        id: e.id,
        dealId: e.dealId,
        label: e.label,
        dueDate: e.dueDate.toISOString(),
        status: e.status,
        apn: e.deal.property.apn,
      }))}
      tasks={tasks.map(t => ({
        id: t.id,
        dealId: t.dealId,
        title: t.title,
        dueDate: t.dueDate!.toISOString(),
        status: t.status,
        priority: t.priority,
        apn: t.deal.property.apn,
      }))}
    />
  )
}
