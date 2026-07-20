import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/db'
import { isSuperAdmin } from '@/lib/admin-auth'
import { STRATEGY_META } from '@/lib/strategy-meta'
import type { StrategyKey } from '@/lib/strategy-meta'
import { requestIdFromValue } from '@/lib/request-correlation'
import TenantDetailClient from './TenantDetailClient'

const ACTION_ICON: Record<string, string> = {
  DEAL_CREATED: '📋',
  DEAL_ARCHIVED: '🗃',
  BLAST_SENT: '📧',
  NOTE_PAYMENT_LOGGED: '💰',
  CHECKLIST_CREATED: '✅',
  TASK_CREATED: '☑️',
  TASK_UPDATED: '✏️',
  TASK_DELETED: '🗑️',
  LOGIN: '🔑',
}

const ACTION_LABEL: Record<string, string> = {
  DEAL_CREATED: 'Deal created',
  DEAL_ARCHIVED: 'Deal archived',
  BLAST_SENT: 'Buyer blast sent',
  NOTE_PAYMENT_LOGGED: 'Note payment logged',
  CHECKLIST_CREATED: 'Checklist created',
  TASK_CREATED: 'Task created',
  TASK_UPDATED: 'Task updated',
  TASK_DELETED: 'Task deleted',
  LOGIN: 'Logged in',
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  trialing: 'bg-blue-100 text-blue-700',
  past_due: 'bg-red-100 text-red-700',
  canceled: 'bg-zinc-100 text-zinc-500',
}

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ requestId?: string }>
}

export default async function TenantDetailPage({ params, searchParams }: Props) {
  if (!(await isSuperAdmin())) redirect('/')
  const { id } = await params
  const rawRequestId = (await searchParams).requestId?.trim()
  const requestId = requestIdFromValue(rawRequestId)
  const invalidRequestId = rawRequestId != null && requestId == null

  const tenant = await db.tenant.findUnique({
    where: { id },
    include: {
      users: { orderBy: { createdAt: 'asc' } },
      modules: { orderBy: { strategy: 'asc' } },
    },
  })
  if (!tenant) notFound()

  const [dealCounts, recentDeal, recentEvents] = await Promise.all([
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
    invalidRequestId
      ? Promise.resolve([])
      : db.auditEvent.findMany({
        where: { tenantId: id, ...(requestId ? { requestId } : {}) },
        orderBy: { createdAt: 'desc' },
        take: 90,
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

      {/* Activity timeline */}
      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Activity Timeline</h2>
            <p className="mt-0.5 text-xs text-zinc-400">Search a browser response request ID within this tenant only.</p>
          </div>
          <form className="flex items-center gap-2" action={`/admin/tenants/${id}`}>
            <input
              name="requestId"
              type="text"
              defaultValue={rawRequestId}
              placeholder="Request ID"
              aria-label="Request ID"
              className="w-64 rounded-lg border border-zinc-300 px-3 py-1.5 font-mono text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
            />
            <button type="submit" className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700">Trace</button>
            {rawRequestId && <Link href={`/admin/tenants/${id}`} className="text-xs text-zinc-500 hover:text-zinc-800">Clear</Link>}
          </form>
        </div>
        {invalidRequestId && (
          <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">Request ID must be a UUID. No events were queried.</p>
        )}
        {requestId && (
          <p className="mb-3 text-xs text-zinc-500">Showing events for <span className="font-mono text-zinc-700">{requestId}</span>.</p>
        )}
        {recentEvents.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <p className="text-sm text-zinc-400">{requestId ? 'No events match this request ID for this tenant.' : 'No recorded activity yet.'}</p>
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
            <div className="divide-y divide-zinc-100 max-h-96 overflow-y-auto">
              {recentEvents.map((e) => {
                const meta = (e.meta ?? {}) as Record<string, unknown>
                return (
                  <div key={e.id} className="flex items-start gap-3 px-4 py-3 hover:bg-zinc-50">
                    <span className="mt-0.5 flex-shrink-0 w-6 text-center text-base">{ACTION_ICON[e.action] ?? '•'}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-zinc-700">{ACTION_LABEL[e.action] ?? e.action}</p>
                      {meta.strategy != null && (
                        <p className="text-xs text-zinc-400">{String(meta.strategy).replace(/_/g, ' ')}{meta.dealId != null ? ` — deal ${String(meta.dealId).slice(-8)}` : ''}</p>
                      )}
                      {e.action === 'BLAST_SENT' && meta.sent != null && (
                        <p className="text-xs text-zinc-400">Sent to {String(meta.sent)} buyer{Number(meta.sent) === 1 ? '' : 's'}</p>
                      )}
                      {e.action === 'NOTE_PAYMENT_LOGGED' && meta.amount != null && (
                        <p className="text-xs text-zinc-400">${Number(meta.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                      )}
                      {e.requestId && (
                        <p className="mt-1 break-all font-mono text-[11px] text-zinc-400">request ID: {e.requestId}</p>
                      )}
                    </div>
                    <time className="flex-shrink-0 text-xs text-zinc-400">{new Date(e.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </section>

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
