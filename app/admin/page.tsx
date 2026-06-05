import { db } from '@/lib/db'
import Link from 'next/link'
import AdminTenantsClient from './AdminTenantsClient'

const MRR_BY_PLAN: Record<string, number> = {
  STARTER: 39,
  PROFESSIONAL: 99,
  TEAM: 249,
  ENTERPRISE: 0, // custom — exclude from auto-calc
}

export default async function AdminPage() {
  const [tenants, jurisdictionStats] = await Promise.all([
    db.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { deals: true, users: true } } },
    }),
    db.jurisdiction.groupBy({
      by: ['isAvailable'],
      _count: true,
    }),
  ])

  // Last active: latest deal updated per tenant
  const lastDeals = await db.deal.groupBy({
    by: ['tenantId'],
    _max: { updatedAt: true },
  })
  const lastActiveMap = Object.fromEntries(
    lastDeals.map((r) => [r.tenantId, r._max.updatedAt])
  )

  const rows = tenants.map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    plan: t.plan as string,
    stripeSubscriptionStatus: t.stripeSubscriptionStatus,
    trialEndsAt: t.trialEndsAt,
    currentPeriodEnd: t.currentPeriodEnd,
    dealCount: t._count.deals,
    userCount: t._count.users,
    mrr: MRR_BY_PLAN[t.plan] ?? 0,
    lastActive: lastActiveMap[t.id] ?? t.createdAt,
    createdAt: t.createdAt,
  }))

  const totalMrr = rows.reduce((sum, r) => sum + r.mrr, 0)
  const totalArr = totalMrr * 12

  const totalJurisdictions = jurisdictionStats.reduce((s, g) => s + g._count, 0)
  const availableJurisdictions = jurisdictionStats.find((g) => g.isAvailable)?._count ?? 0

  return (
    <div className="space-y-10">
      {/* MRR summary */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Tenants',      value: rows.length },
          { label: 'MRR',          value: `$${totalMrr.toLocaleString()}` },
          { label: 'ARR',          value: `$${totalArr.toLocaleString()}` },
          { label: 'Active deals', value: rows.reduce((s, r) => s + r.dealCount, 0) },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-zinc-200 bg-white p-4">
            <p className="text-sm text-zinc-500">{s.label}</p>
            <p className="text-2xl font-semibold text-zinc-900 mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Platform management */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">
          Platform Management
        </h2>
        <div className="grid grid-cols-2 gap-4">
          {/* Tenants card — links to current section */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-zinc-900">Tenants</p>
                <p className="mt-1 text-sm text-zinc-500">
                  Manage accounts, plans, and billing.
                </p>
              </div>
              <span className="rounded-lg bg-zinc-100 p-2 text-lg">🏢</span>
            </div>
            <div className="mt-4 flex items-center gap-4 text-xs text-zinc-400">
              <span>{rows.length} tenants</span>
              <span>{rows.filter(r => r.mrr > 0).length} paying</span>
            </div>
          </div>

          {/* Jurisdictions card */}
          <Link
            href="/admin/rules"
            className="group rounded-xl border border-zinc-200 bg-white p-5 hover:border-zinc-300 hover:shadow-sm transition-all"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-zinc-900 group-hover:text-blue-700 transition-colors">
                  Jurisdiction Rules
                </p>
                <p className="mt-1 text-sm text-zinc-500">
                  Configure deadline rules and availability by county.
                </p>
              </div>
              <span className="rounded-lg bg-zinc-100 p-2 text-lg">⚖️</span>
            </div>
            <div className="mt-4 flex items-center gap-4 text-xs">
              <span className="text-emerald-600 font-medium">
                {availableJurisdictions} available
              </span>
              <span className="text-amber-600 font-medium">
                {totalJurisdictions - availableJurisdictions} not configured
              </span>
            </div>
          </Link>
        </div>
      </section>

      {/* Tenant list */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">
          All Tenants
        </h2>
        <AdminTenantsClient rows={rows} />
      </section>
    </div>
  )
}
