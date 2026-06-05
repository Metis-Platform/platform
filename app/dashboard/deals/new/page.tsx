import { db } from '@/lib/db'
import { NewLienForm } from './form'

export const dynamic = 'force-dynamic'

const STRATEGY_TITLES: Record<string, { title: string; subtitle: string }> = {
  TAX_DEED: {
    title: 'New Tax Deed',
    subtitle: 'Track a tax deed purchase. Deadlines are calculated from the sale date and jurisdiction rules.',
  },
  FORECLOSURE: {
    title: 'New Foreclosure',
    subtitle: 'Track a foreclosure auction bid. Log pre-foreclosure leads or record a winning bid.',
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
  const strategy = strategyParam === 'TAX_DEED' ? 'TAX_DEED'
    : strategyParam === 'FORECLOSURE' ? 'FORECLOSURE'
    : 'TAX_LIEN'
  const { title, subtitle } = STRATEGY_TITLES[strategy]

  const jurisdictions = await db.jurisdiction.findMany({
    where: { isAvailable: true },
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
