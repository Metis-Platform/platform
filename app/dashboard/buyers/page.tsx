import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { syncUserToDatabase } from '@/lib/sync-user'
import { db } from '@/lib/db'

export default async function BuyersPage() {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) redirect('/sign-in')
  const synced = await syncUserToDatabase()
  if (!synced) redirect('/onboarding')
  const { tenant } = synced

  const buyers = await db.contact.findMany({
    where: { tenantId: tenant.id, type: 'BUYER' },
    include: { buyerProfile: true },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { company: 'asc' }],
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Buyers</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Cash buyers and buy-box preferences for wholesale deal matching.</p>
        </div>
        <Link
          href="/dashboard/buyers/new"
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 transition-colors"
        >
          + Add Buyer
        </Link>
      </div>

      {buyers.length === 0 ? (
        <div className="text-center py-16 text-zinc-400">
          <p className="text-base font-medium mb-1">No buyers yet</p>
          <p className="text-sm">Add cash buyers to match against wholesale deals.</p>
        </div>
      ) : (
        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50">
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Name / Company</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Contact</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Price Range</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">States</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {buyers.map(b => {
                const name = [b.firstName, b.lastName].filter(Boolean).join(' ') || b.company || '—'
                const profile = b.buyerProfile
                const priceRange = profile?.priceMin || profile?.priceMax
                  ? [
                      profile.priceMin ? `$${Number(profile.priceMin).toLocaleString()}` : null,
                      profile.priceMax ? `$${Number(profile.priceMax).toLocaleString()}` : null,
                    ]
                      .filter(Boolean)
                      .join(' – ')
                  : '—'
                const states = profile?.preferredStates.length
                  ? profile.preferredStates.join(', ')
                  : 'Any'

                return (
                  <tr key={b.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/buyers/${b.id}`} className="font-medium text-zinc-900 hover:text-blue-600">
                        {name}
                      </Link>
                      {b.company && (b.firstName || b.lastName) && (
                        <div className="text-xs text-zinc-500">{b.company}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      <div>{b.email ?? '—'}</div>
                      {b.phone && <div className="text-xs text-zinc-400">{b.phone}</div>}
                    </td>
                    <td className="px-4 py-3 text-zinc-700 font-mono text-xs">{priceRange}</td>
                    <td className="px-4 py-3 text-zinc-600 text-xs">{states}</td>
                    <td className="px-4 py-3">
                      {profile?.isActive === false ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zinc-100 text-zinc-500">Inactive</span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700">Active</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
