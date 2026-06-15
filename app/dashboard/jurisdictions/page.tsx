import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { syncUserToDatabase } from '@/lib/sync-user'
import { JurisdictionsTable } from './JurisdictionsTable'

export const dynamic = 'force-dynamic'

export default async function JurisdictionsPage() {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) redirect('/sign-in')

  const synced = await syncUserToDatabase()
  if (!synced) redirect('/onboarding')

  const jurisdictions = await db.jurisdiction.findMany({
    orderBy: [{ state: 'asc' }, { county: 'asc' }],
    select: {
      id: true,
      state: true,
      stateName: true,
      county: true,
      investmentType: true,
      isAvailable: true,
      ruleSets: {
        where: { isActive: true },
        select: { _count: { select: { rules: true } } },
        take: 1,
      },
    },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Jurisdiction Research</h1>
        <p className="mt-1 text-sm text-zinc-500">
          State and county tax sale rules, deadlines, statutes, and official research links.
        </p>
      </div>
      <JurisdictionsTable jurisdictions={jurisdictions} />
    </div>
  )
}
