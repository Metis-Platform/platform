import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { syncUserToDatabase } from '@/lib/sync-user'
import NewBuyerForm from './form'

export default async function NewBuyerPage() {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) redirect('/sign-in')
  const synced = await syncUserToDatabase()
  if (!synced) redirect('/onboarding')

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-zinc-500 mb-3">
          <Link href="/dashboard/buyers" className="hover:text-zinc-900">Buyers</Link>
          <span>/</span>
          <span className="text-zinc-900">New Buyer</span>
        </div>
        <h1 className="text-2xl font-semibold text-zinc-900">Add Buyer</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Add a cash buyer and their buy-box preferences for deal matching.</p>
      </div>
      <NewBuyerForm />
    </div>
  )
}
