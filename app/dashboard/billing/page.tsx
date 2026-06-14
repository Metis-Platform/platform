import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { ALL_STRATEGIES, STRATEGY_META } from '@/lib/strategy-meta'
import type { StrategyKey } from '@/lib/strategy-meta'
import BillingPortal from './BillingPlans'

export default async function BillingPage() {
  const { orgId } = await auth()
  let ownedModules: { strategy: string; tier: string; createdAt: Date }[] = []

  if (orgId) {
    const tenant = await db.tenant.findUnique({ where: { clerkOrgId: orgId }, select: { id: true } })
    if (tenant) {
      ownedModules = await db.tenantModule.findMany({
        where: { tenantId: tenant.id },
        select: { strategy: true, tier: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      })
    }
  }

  const salesUrl = process.env.SALES_CONTACT_URL ?? 'mailto:support@metisplatforms.com'
  const creatableStrategies = ALL_STRATEGIES.filter((s) => s.creatable)
  const ownedKeys = new Set(ownedModules.map((m) => m.strategy))
  const availableStrategies = creatableStrategies.filter((s) => !ownedKeys.has(s.key))

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-zinc-900">Billing &amp; Modules</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Your active modules and available add-ons.
        </p>
      </div>

      {ownedModules.length > 0 ? (
        <div className="mb-8">
          <h2 className="text-base font-semibold text-zinc-900 mb-3">Your Modules</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ownedModules.map((m) => {
              const meta = STRATEGY_META[m.strategy as StrategyKey]
              return (
                <div key={m.strategy} className="rounded-xl border border-zinc-200 bg-white p-4">
                  <div className="flex items-start justify-between mb-2">
                    <span className="font-medium text-zinc-900">{meta?.label ?? m.strategy}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      m.tier === 'PREMIUM'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {m.tier === 'PREMIUM' ? 'Premium' : 'Standard'}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400">
                    Active since {new Date(m.createdAt).toLocaleDateString()}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="mb-8 rounded-xl border border-zinc-200 bg-white p-6 text-center">
          <p className="text-sm text-zinc-500">No modules active yet. Contact us to get started.</p>
        </div>
      )}

      {availableStrategies.length > 0 && (
        <div className="mb-8">
          <h2 className="text-base font-semibold text-zinc-900 mb-3">Available Modules</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {availableStrategies.map((s) => (
              <div key={s.key} className="rounded-xl border border-zinc-200 bg-white p-4 flex flex-col">
                <span className="font-medium text-zinc-900 mb-1">{s.label}</span>
                <p className="text-xs text-zinc-400 flex-1 mb-4">{s.newSubtitle}</p>
                <a
                  href={salesUrl}
                  className="inline-flex items-center justify-center rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
                >
                  Contact us to add
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      <BillingPortal />
    </div>
  )
}
