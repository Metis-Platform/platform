import { db } from '@/lib/db'
import AdminTenantsClient from './AdminTenantsClient'

const MRR_BY_PLAN: Record<string, number> = {
  STARTER: 39,
  PROFESSIONAL: 99,
  TEAM: 249,
  ENTERPRISE: 0, // custom — exclude from auto-calc
}

export default async function AdminPage() {
  const tenants = await db.tenant.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { deals: true, users: true } },
    },
  })

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

  return (
    <div>
      {/* MRR summary */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Tenants', value: rows.length },
          { label: 'MRR', value: `$${totalMrr.toLocaleString()}` },
          { label: 'ARR', value: `$${totalArr.toLocaleString()}` },
          { label: 'Active deals', value: rows.reduce((s, r) => s + r.dealCount, 0) },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-zinc-200 bg-white p-4">
            <p className="text-sm text-zinc-500">{s.label}</p>
            <p className="text-2xl font-semibold text-zinc-900 mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      <AdminTenantsClient rows={rows} />
    </div>
  )
}
