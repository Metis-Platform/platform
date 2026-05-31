import { db } from '@/lib/db'
import { NewLienForm } from './form'

// Force server-render on every request so the jurisdiction list always
// comes from a live DB query. Without this Next.js prerenders at build time
// and the dropdown can be empty if Neon is cold during the Vercel build.
export const dynamic = 'force-dynamic'

export default async function NewLienPage() {
  const jurisdictions = await db.jurisdiction.findMany({
    orderBy: [{ stateName: 'asc' }, { county: 'asc' }],
  })

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-900">New Tax Lien</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Deadlines are calculated automatically from the issue date and jurisdiction rules.
        </p>
      </div>
      <NewLienForm jurisdictions={jurisdictions} />
    </div>
  )
}
