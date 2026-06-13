import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { syncUserToDatabase } from '@/lib/sync-user'
import { db } from '@/lib/db'
import BuyerEditForm from './form'

export default async function BuyerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { userId, orgId } = await auth()
  if (!userId || !orgId) redirect('/sign-in')
  const synced = await syncUserToDatabase()
  if (!synced) redirect('/onboarding')
  const { tenant } = synced

  const contact = await db.contact.findUnique({
    where: { id, tenantId: tenant.id, type: 'BUYER' },
    include: {
      buyerProfile: true,
      wholesaleDeals: {
        include: { deal: { include: { property: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  })
  if (!contact) notFound()

  const profile = contact.buyerProfile
  const name = [contact.firstName, contact.lastName].filter(Boolean).join(' ') || contact.company || 'Buyer'

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-zinc-500 mb-3">
          <Link href="/dashboard/buyers" className="hover:text-zinc-900">Buyers</Link>
          <span>/</span>
          <span className="text-zinc-900">{name}</span>
        </div>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-zinc-900">{name}</h1>
          {profile?.isActive === false && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zinc-100 text-zinc-500">Inactive</span>
          )}
        </div>
      </div>

      <BuyerEditForm contact={contact} profile={profile} />

      {contact.wholesaleDeals.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-zinc-700 mb-3">Linked Wholesale Deals</h2>
          <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50">
                  <th className="text-left px-4 py-2 text-xs font-medium text-zinc-500 uppercase tracking-wide">Property</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-zinc-500 uppercase tracking-wide">Stage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {contact.wholesaleDeals.map(w => (
                  <tr key={w.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-2">
                      <Link href={`/dashboard/deals/${w.dealId}`} className="text-zinc-900 hover:text-blue-600 font-medium">
                        {w.deal.property.address}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-zinc-500">{w.dispositionStatus ?? w.deal.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
