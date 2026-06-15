import { notFound, redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { syncUserToDatabase } from '@/lib/sync-user'
import { db } from '@/lib/db'
import { EditContactForm } from './form'

export default async function EditContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) redirect('/sign-in')
  const synced = await syncUserToDatabase()
  if (!synced) redirect('/onboarding')
  const { tenant } = synced
  const { id } = await params

  const contact = await db.contact.findUnique({ where: { id, tenantId: tenant.id } })
  if (!contact) notFound()

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-900">Edit Contact</h1>
      </div>
      <EditContactForm contact={contact} />
    </div>
  )
}
