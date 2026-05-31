import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { syncUserToDatabase } from '@/lib/sync-user'
import { db } from '@/lib/db'
import { EditLienForm } from './form'

export default async function EditLienPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { userId, orgId } = await auth()
  if (!userId || !orgId) redirect('/sign-in')

  const synced = await syncUserToDatabase()
  if (!synced) redirect('/onboarding')
  const { tenant } = synced

  const deal = await db.deal.findUnique({
    where: { id, tenantId: tenant.id },
    include: {
      property: { include: { jurisdiction: true } },
      taxLien: true,
    },
  })

  if (!deal) notFound()

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-zinc-500 mb-3">
          <Link href="/dashboard/deals" className="hover:text-zinc-900">Liens</Link>
          <span>/</span>
          <Link href={`/dashboard/deals/${deal.id}`} className="hover:text-zinc-900 font-mono">{deal.property.apn}</Link>
          <span>/</span>
          <span className="text-zinc-900">Edit</span>
        </div>
        <h1 className="text-2xl font-semibold text-zinc-900">Edit Lien</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Jurisdiction and APN cannot be changed. Updating the issue date will regenerate all deadlines.
        </p>
      </div>

      {/* Read-only jurisdiction + APN context */}
      <div className="bg-zinc-50 rounded-lg border border-zinc-200 px-4 py-3 mb-4 text-sm text-zinc-600">
        <span className="font-medium text-zinc-800">{deal.property.apn}</span>
        {' · '}
        {deal.property.jurisdiction.county} County, {deal.property.jurisdiction.stateName}
      </div>

      <EditLienForm deal={deal} />
    </div>
  )
}
