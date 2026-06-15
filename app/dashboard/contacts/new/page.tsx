import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { syncUserToDatabase } from '@/lib/sync-user'
import { NewContactForm } from './form'

export default async function NewContactPage() {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) redirect('/sign-in')
  const synced = await syncUserToDatabase()
  if (!synced) redirect('/onboarding')

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-900">New Contact</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Add a seller, buyer, contractor, tenant, or other contact.</p>
      </div>
      <NewContactForm />
    </div>
  )
}
