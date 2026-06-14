import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/db'
import { isSuperAdmin } from '@/lib/admin-auth'
import { STRATEGY_META } from '@/lib/strategy-meta'
import type { StrategyKey } from '@/lib/strategy-meta'
import TenantDetailClient from './TenantDetailClient'

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  trialing: 'bg-blue-100 text-blue-700',
  past_due: 'bg-red-100 text-red-700',
  canceled: 'bg-zinc-100 text-zinc-500',
}

export default async function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isSuperAdmin())) redirect('/')
  const { id } = await params

  const tenant = await db.tenant.findUnique({
    where: { id },
    include: {
      users: { orderBy: { createdAt: 'asc' } },
      modules: { orderBy: { strategy: 'asc' } },
    },
  })
  if (!tenant) notFound()

  const [dealCounts, recentDeal] = await Promise.all([
    db.deal.groupBy({
      by: ['strategyType'],
      where: { tenantId: id },
      _count: true,
    }),
    db.deal.findFirst({
      where: { tenantId: id },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, updatedAt: true, strategyType: true },
    }),
  ])

  const totalDeals = dealCounts.reduce((s, g) => s + g._count, 0)

  const primaryUserEmail = tenant.users[0]?.email ?? `support+${tenant.slug}@metisplatforms.com`

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-zinc-400 mb-1">
            <Link href="/admin" className="hover:text-zinc-600">Admin</Link>
            <span>/</span>
            <span className="text-zinc-700">{tenant.name}</span>
          </div>
          <h1 className="text-2xl font-semibold text-zinc-900">{tenant.name}</h1>
          <p className="text-sm text-zinc-400 mt-0.5">/{tenant.slug}</p>
        </div>
        {tenant.stripeSubscriptionStatus && (
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${STATUS_COLORS[tenant.stripeSubscriptionStatus] ?? 'bg-zinc-100 text-zinc-600'}`}>
            {tenant.stripeSubscriptionStatus}
          </span>
        )}
      </div>

      {/* Account info */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Created', value: tenant.createdAt.toLocaleDateString() },
          { label: 'Users', value: tenant.users.length },
          { label: 'Total deals', value: totalDeals },
          {
            label: 'Subscription',
            value: tenant.currentPeriodEnd
              ? `Renews ${new Date(tenant.currentPeriodEnd).toLocaleDateString()}`
              : 'No subscription',
          },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-zinc-200 bg-white p-4">
            <p className="text-xs text-zinc-500">{s.label}</p>
            <p className="text-lg font-semibold text-zinc-900 mt-0.5">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Deal activity */}
      {totalDeals > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-zinc-900 mb-3">Deal Activity</h2>
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <div className="flex flex-wrap gap-3 mb-3">
              {dealCounts.map((g) => {
                const meta = STRATEGY_META[g.strategyType as StrategyKey]
                return (
                  <span key={g.strategyType} className="inline-flex items-center gap-1.5 text-xs text-zinc-600">
                    <span className="font-medium">{g._count}</span>
                    <span className="text-zinc-400">{meta?.label ?? g.strategyType}</span>
                  </span>
                )
              })}
            </div>
            {recentDeal && (
              <p className="text-xs text-zinc-400">
                Last active {new Date(recentDeal.updatedAt).toLocaleDateString()}
                {' — '}
                <Link
                  href={`/dashboard/deals/${recentDeal.id}`}
                  className="text-blue-600 hover:underline"
                >
                  view deal
                </Link>
              </p>
            )}
          </div>
        </section>
      )}

      {/* Interactive sections (module panel, users table, admin notes) */}
      <TenantDetailClient
        tenantId={tenant.id}
        tenantEmail={primaryUserEmail}
        trialEndsAt={tenant.trialEndsAt?.toISOString() ?? null}
        adminNotes={tenant.adminNotes ?? null}
        modules={tenant.modules.map((m) => ({
          strategy: m.strategy,
          tier: m.tier,
          createdAt: m.createdAt.toISOString(),
        }))}
        users={tenant.users.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          createdAt: u.createdAt.toISOString(),
        }))}
      />
    </div>
  )
}
