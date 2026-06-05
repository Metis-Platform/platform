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
  const now   = new Date()
  const year  = params.year  ? parseInt(params.year)  : now.getFullYear()
  const month = params.month ? parseInt(params.month) : now.getMonth()

  const start = new Date(year, month, 1)
  const end   = new Date(year, month + 1, 0, 23, 59, 59)

  // Picker: 3 months prior → 32 months ahead (36 total) so arrows can scroll forward ~2.5 years
  const pickerStart    = new Date(year, month - 3, 1)
  const pickerEnd      = new Date(year, month + 33, 0, 23, 59, 59)
  const thirtyDaysOut  = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  const [events, tasks, pickerEvents, pickerTasks] = await Promise.all([
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
    db.event.findMany({
      where: { deal: { tenantId: tenant.id }, dueDate: { gte: pickerStart, lte: pickerEnd } },
      select: { dueDate: true, status: true },
    }),
    db.task.findMany({
      where: {
        tenantId: tenant.id,
        dueDate: { gte: pickerStart, lte: pickerEnd },
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
      },
      select: { dueDate: true },
    }),
  ])

  // Build 36-month summaries for the picker (events + tasks)
  const monthSummaries = Array.from({ length: 36 }, (_, i) => {
    let m = month - 3 + i
    let y = year
    while (m < 0)  { m += 12; y -= 1 }
    while (m > 11) { m -= 12; y += 1 }

    const eventMs = pickerEvents.filter(e => {
      const d = new Date(e.dueDate)
      return d.getFullYear() === y && d.getMonth() === m
    })
    const taskMs = pickerTasks.filter(t => {
      const d = new Date(t.dueDate!)
      return d.getFullYear() === y && d.getMonth() === m
    })

    return {
      year:  y,
      month: m,
      hasOverdue:  eventMs.some(e => e.status === 'OVERDUE') ||
                   taskMs.some(t => new Date(t.dueDate!) < now),
      hasDueSoon:  eventMs.some(e => e.status === 'PENDING' && new Date(e.dueDate) <= thirtyDaysOut) ||
                   taskMs.some(t => { const d = new Date(t.dueDate!); return d >= now && d <= thirtyDaysOut }),
      hasUpcoming: eventMs.some(e => e.status === 'PENDING') || taskMs.length > 0,
    }
  })

  return (
    <CalendarClient
      year={year}
      month={month}
      events={events.map(e => ({
        id:            e.id,
        dealId:        e.dealId,
        label:         e.label,
        dueDate:       e.dueDate.toISOString(),
        completedDate: e.completedDate?.toISOString() ?? null,
        status:        e.status,
        apn:           e.deal.property.apn,
        address:       e.deal.property.address,
        eventType:     e.eventType,
        notes:         e.notes,
      }))}
      tasks={tasks.map(t => ({
        id:       t.id,
        dealId:   t.dealId,
        title:    t.title,
        dueDate:  t.dueDate!.toISOString(),
        status:   t.status,
        priority: t.priority,
        apn:      t.deal.property.apn,
      }))}
      monthSummaries={monthSummaries}
    />
  )
}
