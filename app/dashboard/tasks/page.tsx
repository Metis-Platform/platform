import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { syncUserToDatabase } from '@/lib/sync-user'
import { db } from '@/lib/db'
import TaskBoard from './TaskBoard'

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ dealId?: string }> }) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) redirect('/sign-in')

  const synced = await syncUserToDatabase()
  if (!synced) redirect('/onboarding')
  const { tenant } = synced

  const { dealId: prefilledDealId } = await searchParams

  const [tasks, users, deals] = await Promise.all([
    db.task.findMany({
      where: { tenantId: tenant.id, status: { not: 'CANCELLED' } },
      include: {
        deal: { include: { property: true } },
        assignedTo: true,
        comments: {
          include: { user: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }, { createdAt: 'asc' }],
    }),
    db.user.findMany({
      where: { tenantId: tenant.id },
      select: { id: true, name: true, email: true },
    }),
    db.deal.findMany({
      where: { tenantId: tenant.id, status: { not: 'CLOSED' } },
      include: { property: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
  ])

  return (
    <TaskBoard
      prefilledDealId={prefilledDealId}
      tasks={tasks.map(t => ({
        id: t.id,
        dealId: t.dealId,
        title: t.title,
        description: t.description,
        taskType: t.taskType,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate?.toISOString() ?? null,
        completedAt: t.completedAt?.toISOString() ?? null,
        apn: t.deal.property.apn,
        address: t.deal.property.address,
        assignedTo: t.assignedTo
          ? { id: t.assignedTo.id, name: t.assignedTo.name, email: t.assignedTo.email }
          : null,
        comments: t.comments.map(c => ({
          id: c.id,
          body: c.body,
          createdAt: c.createdAt.toISOString(),
          user: { id: c.user.id, name: c.user.name, email: c.user.email },
        })),
      }))}
      users={users}
      deals={deals.map(d => ({ id: d.id, apn: d.property.apn, address: d.property.address }))}
    />
  )
}
