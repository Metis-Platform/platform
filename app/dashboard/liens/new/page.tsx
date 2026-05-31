import { db } from '@/lib/db'
import { NewLienForm } from './form'

// Force server-render on every request so the jurisdiction list always
// comes from a live DB query. Without this Next.js prerenders at build time
// and the dropdown can be empty if Neon is cold during the Vercel build.
export const dynamic = 'force-dynamic'

const STRATEGY_TITLES: Record<string, { title: string; subtitle: string }> = {
  TAX_DEED: {
    title: 'New Tax Deed',
    subtitle: 'Track a tax deed purchase. Deadlines are calculated from the sale date and jurisdiction rules.',
  },
  TAX_LIEN: {
    title: 'New Tax Lien',
    subtitle: 'Deadlines are calculated automatically from the issue date and jurisdiction rules.',
  },
}

export default async function NewLienPage({
  searchParams,
}: {
  searchParams: Promise<{ strategy?: string }>
}) {
  const { strategy: strategyParam } = await searchParams
  const strategy = strategyParam === 'TAX_DEED' ? 'TAX_DEED' : 'TAX_LIEN'
  const { title, subtitle } = STRATEGY_TITLES[strategy]

  const jurisdictions = await db.jurisdiction.findMany({
    orderBy: [{ stateName: 'asc' }, { county: 'asc' }],
  })

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-900">{title}</h1>
        <p className="text-sm text-zinc-500 mt-0.5">{subtitle}</p>
      </div>
      <NewLienForm jurisdictions={jurisdictions} strategy={strategy} />
    </div>
  )
}
