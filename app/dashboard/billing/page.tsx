import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { getEnabledStrategies } from '@/lib/entitlements'
import { ALL_STRATEGIES } from '@/lib/strategy-meta'
import BillingPlans from './BillingPlans'

const STRATEGY_LABEL: Record<string, string> = {
  TAX_LIEN:    'Tax Lien',
  TAX_DEED:    'Tax Deed',
  FORECLOSURE: 'Foreclosure',
  FIX_FLIP:    'Fix & Flip',
  WHOLESALE:   'Wholesale',
  BUY_HOLD:    'Buy & Hold',
  LAND:        'Land',
  MULTIFAMILY: 'Multifamily',
}

export default async function BillingPage() {
  const { orgId } = await auth()
  let ownedStrategies: string[] = []

  if (orgId) {
    const tenant = await db.tenant.findUnique({ where: { clerkOrgId: orgId }, select: { id: true } })
    if (tenant) ownedStrategies = await getEnabledStrategies(tenant.id)
  }

  const creatableStrategies = ALL_STRATEGIES.filter(s => s.creatable)

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-zinc-900">Billing</h1>
        <p className="mt-1 text-sm text-zinc-500">
          14-day free trial on all plans — no credit card required to start.
        </p>
      </div>

      {/* Owned modules */}
      <div className="mb-8 rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-base font-semibold text-zinc-900 mb-1">Your Modules</h2>
        <p className="text-sm text-zinc-500 mb-4">
          Strategy modules you currently have access to. Contact support to add or remove modules.
        </p>
        <div className="flex flex-wrap gap-2">
          {creatableStrategies.map(s => {
            const owned = ownedStrategies.includes(s.key)
            return (
              <span
                key={s.key}
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                  owned
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-zinc-100 text-zinc-400'
                }`}
              >
                {owned ? '✓ ' : ''}{STRATEGY_LABEL[s.key] ?? s.key}
              </span>
            )
          })}
        </div>
      </div>

      <BillingPlans />
    </div>
  )
}
