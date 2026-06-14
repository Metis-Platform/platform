import { redirect } from 'next/navigation'
import Link from 'next/link'
import { isSuperAdmin } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import { ALL_STRATEGIES } from '@/lib/strategy-meta'
import PricingClient from './PricingClient'

export default async function PricingPage() {
  if (!(await isSuperAdmin())) redirect('/')

  const prices = await db.modulePrice.findMany({
    orderBy: [{ strategy: 'asc' }, { tier: 'asc' }],
  })

  const creatableStrategies = ALL_STRATEGIES.filter(s => s.creatable)

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <div className="flex items-center gap-2 text-sm text-zinc-400 mb-1">
          <Link href="/admin" className="hover:text-zinc-600">Admin</Link>
          <span>/</span>
          <span className="text-zinc-700">Pricing</span>
        </div>
        <h1 className="text-2xl font-semibold text-zinc-900">Module Pricing</h1>
        <p className="text-sm text-zinc-400 mt-0.5">
          Configure Stripe price IDs and display prices for each module. Changes take effect immediately on the billing page.
        </p>
      </div>

      <PricingClient
        strategies={creatableStrategies.map(s => ({ key: s.key, label: s.label }))}
        prices={prices.map(p => ({
          id: p.id,
          strategy: p.strategy,
          tier: p.tier,
          stripePriceId: p.stripePriceId,
          displayPrice: p.displayPrice ? Number(p.displayPrice) : null,
          currency: p.currency,
          isActive: p.isActive,
        }))}
      />
    </div>
  )
}
