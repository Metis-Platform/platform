import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import TeamClient from './TeamClient'

export default async function TeamPage() {
  const result = await getCurrentUser()
  if (!result) redirect('/sign-in')

  const { tenant, user } = result

  const members = await db.user.findMany({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: 'asc' },
  })

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-zinc-900">Team</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Manage team members and their access levels.
        </p>
      </div>
      <TeamClient members={members} currentUserId={user.id} isOwner={user.role === 'OWNER'} />
    </div>
  )
}
