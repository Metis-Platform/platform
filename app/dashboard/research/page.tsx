import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import ResearchForm from './ResearchForm'

export const dynamic = 'force-dynamic'

export default async function ResearchPage() {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) redirect('/sign-in')

  const jurisdictions = await db.jurisdiction.findMany({
    orderBy: [{ stateName: 'asc' }, { county: 'asc' }],
    select: { id: true, fips: true, state: true, stateName: true, county: true },
  })

  const jWithFips = jurisdictions.filter(j => j.fips != null) as Array<{
    id: string
    fips: string
    state: string
    stateName: string
    county: string
  }>

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-900">Pre-Purchase Research</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Enter an APN before auction day. The platform runs all 30 exit evaluators, flags blocking issues,
          and calculates your Maximum Allowable Offer so you know exactly how much to bid — and what to skip.
        </p>
      </div>
      <ResearchForm jurisdictions={jWithFips} />
    </div>
  )
}
