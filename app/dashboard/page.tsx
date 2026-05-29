import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { syncUserToDatabase } from '@/lib/sync-user'

export default async function DashboardPage() {
  const { userId, orgId } = await auth()

  if (!userId || !orgId) redirect('/sign-in')

  // Sync Clerk identity to our database on first visit
  const synced = await syncUserToDatabase()
  if (!synced) redirect('/onboarding')

  const { tenant, user } = synced

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-zinc-900">
        Welcome, {user.name ?? user.email}
      </h1>
      <p className="mt-1 text-zinc-500">
        {tenant.name} &mdash; {tenant.plan} plan
      </p>

      <div className="mt-8 rounded-lg border border-zinc-200 bg-white p-6">
        <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wide">
          Account
        </h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex gap-2">
            <dt className="w-28 text-zinc-500">User ID</dt>
            <dd className="font-mono text-zinc-900">{user.id}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-28 text-zinc-500">Email</dt>
            <dd className="text-zinc-900">{user.email}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-28 text-zinc-500">Role</dt>
            <dd className="text-zinc-900">{user.role}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-28 text-zinc-500">Tenant ID</dt>
            <dd className="font-mono text-zinc-900">{tenant.id}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-28 text-zinc-500">Org</dt>
            <dd className="text-zinc-900">{tenant.name}</dd>
          </div>
        </dl>
      </div>

      <p className="mt-6 text-sm text-zinc-400">
        ✓ Database sync confirmed — your account is active.
      </p>
    </div>
  )
}
