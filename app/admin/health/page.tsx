import { redirect } from 'next/navigation'
import Link from 'next/link'
import { isSuperAdmin } from '@/lib/admin-auth'
import { db } from '@/lib/db'

type JobRow = { state: string; count: bigint }
type FailedJob = { id: string; name: string; createdon: Date; completedon: Date | null; data: unknown; output: unknown }

async function getJobStats(): Promise<{ rows: JobRow[]; failed: FailedJob[]; error: string | null }> {
  try {
    const rows = await db.$queryRaw<JobRow[]>`
      SELECT state, count(*)::bigint AS count
      FROM pgboss.job
      WHERE createdon > now() - interval '7 days'
      GROUP BY state
    `
    const failed = await db.$queryRaw<FailedJob[]>`
      SELECT id, name, createdon, completedon, data, output
      FROM pgboss.job
      WHERE state = 'failed'
      ORDER BY createdon DESC
      LIMIT 20
    `
    return { rows, failed, error: null }
  } catch {
    return { rows: [], failed: [], error: 'Queue schema not initialized' }
  }
}

export default async function HealthPage() {
  if (!(await isSuperAdmin())) redirect('/')

  const now = new Date()
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 86_400_000)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000)

  const [
    { rows: jobRows, failed: failedJobs, error: jobError },
    totalTenants,
    activeTenants,
    dealsByStrategy,
    dealsLast7d,
    emailBounces30d,
    emailComplaints30d,
    bouncedByTenant,
    dormantUsers,
    zeroDealsLast30d,
  ] = await Promise.all([
    getJobStats(),
    db.tenant.count(),
    db.tenant.count({ where: { createdAt: { lte: now } } }),
    db.deal.groupBy({ by: ['strategyType'], _count: true }),
    db.deal.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    db.emailEvent.count({ where: { type: 'bounced', timestamp: { gte: thirtyDaysAgo } } }),
    db.emailEvent.count({ where: { type: 'complained', timestamp: { gte: thirtyDaysAgo } } }),
    db.emailEvent.groupBy({
      by: ['tenantId'],
      where: { type: 'bounced', timestamp: { gte: thirtyDaysAgo }, tenantId: { not: null } },
      _count: true,
      orderBy: { _count: { tenantId: 'desc' } },
      take: 5,
    }),
    // Tenants with users who haven't logged in for 14+ days (churn signal)
    db.tenant.findMany({
      where: {
        users: {
          every: {
            OR: [
              { lastActiveAt: null },
              { lastActiveAt: { lt: fourteenDaysAgo } },
            ],
          },
        },
      },
      select: {
        id: true,
        name: true,
        users: { select: { lastActiveAt: true }, orderBy: { lastActiveAt: 'desc' }, take: 1 },
      },
      take: 10,
    }),
    // Tenants with zero deals in last 30 days (activation signal)
    db.tenant.findMany({
      where: {
        deals: { none: { createdAt: { gte: thirtyDaysAgo } } },
        createdAt: { lte: thirtyDaysAgo },
      },
      select: { id: true, name: true, createdAt: true },
      take: 10,
    }),
  ])

  const totalDeals = dealsByStrategy.reduce((s, g) => s + g._count, 0)
  const totalEmails30d = emailBounces30d + emailComplaints30d
  const bounceRate = totalEmails30d > 0 ? ((emailBounces30d / totalEmails30d) * 100).toFixed(1) : '0.0'
  const highBounceRate = parseFloat(bounceRate) > 2

  const jobStateMap: Record<string, number> = {}
  for (const r of jobRows) jobStateMap[r.state] = Number(r.count)

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <div className="flex items-center gap-2 text-sm text-zinc-400 mb-1">
          <Link href="/admin" className="hover:text-zinc-600">Admin</Link>
          <span>/</span>
          <span className="text-zinc-700">Platform Health</span>
        </div>
        <h1 className="text-2xl font-semibold text-zinc-900">Platform Health</h1>
        <p className="text-sm text-zinc-400 mt-0.5">Last refreshed {now.toLocaleTimeString()}</p>
      </div>

      {/* Panel 4 — System at a glance */}
      <section>
        <h2 className="text-sm font-semibold text-zinc-900 mb-3">System at a Glance</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: 'Total tenants', value: totalTenants },
            { label: 'Total deals', value: totalDeals },
            { label: 'Deals (last 7d)', value: dealsLast7d },
            { label: 'Active tenants', value: activeTenants },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-zinc-200 bg-white p-4">
              <p className="text-xs text-zinc-500">{s.label}</p>
              <p className="text-2xl font-semibold text-zinc-900 mt-0.5">{s.value}</p>
            </div>
          ))}
        </div>
        {dealsByStrategy.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-4 rounded-xl border border-zinc-200 bg-white px-4 py-3">
            {dealsByStrategy.map((g) => (
              <span key={g.strategyType} className="text-xs text-zinc-600">
                <span className="font-semibold">{g._count}</span>
                <span className="ml-1 text-zinc-400">{g.strategyType.replace(/_/g, ' ')}</span>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Panel 1 — Job queue health */}
      <section>
        <h2 className="text-sm font-semibold text-zinc-900 mb-3">Job Queue (last 7 days)</h2>
        {jobError ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <p className="text-sm text-zinc-400">{jobError} — no background jobs have been registered yet.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
              {['created', 'active', 'completed', 'failed', 'expired'].map((state) => (
                <div key={state} className={`rounded-xl border p-4 ${state === 'failed' && (jobStateMap[state] ?? 0) > 0 ? 'border-red-200 bg-red-50' : 'border-zinc-200 bg-white'}`}>
                  <p className="text-xs text-zinc-500 capitalize">{state}</p>
                  <p className={`text-2xl font-semibold mt-0.5 ${state === 'failed' && (jobStateMap[state] ?? 0) > 0 ? 'text-red-700' : 'text-zinc-900'}`}>
                    {jobStateMap[state] ?? 0}
                  </p>
                </div>
              ))}
            </div>
            {failedJobs.length > 0 && (
              <div className="mt-3 rounded-xl border border-red-200 bg-white overflow-hidden">
                <div className="border-b border-red-100 px-4 py-2">
                  <h3 className="text-xs font-semibold text-red-700">Failed Jobs</h3>
                </div>
                <div className="divide-y divide-zinc-100">
                  {failedJobs.map((job) => (
                    <div key={String(job.id)} className="flex items-start gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-zinc-800">{job.name}</p>
                        <p className="text-xs text-zinc-400 font-mono truncate">
                          {JSON.stringify(job.output).slice(0, 120)}
                        </p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <p className="text-xs text-zinc-400">
                          {new Date(job.createdon).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        </p>
                        <RetryForm jobId={String(job.id)} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* Panel 2 — Email delivery health */}
      <section>
        <h2 className="text-sm font-semibold text-zinc-900 mb-3">
          Email Delivery (last 30 days)
          {highBounceRate && (
            <span className="ml-2 inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
              High bounce rate
            </span>
          )}
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Bounces', value: emailBounces30d, alert: emailBounces30d > 0 },
            { label: 'Complaints', value: emailComplaints30d, alert: emailComplaints30d > 0 },
            { label: 'Bounce rate', value: `${bounceRate}%`, alert: highBounceRate },
          ].map((s) => (
            <div key={s.label} className={`rounded-xl border p-4 ${s.alert ? 'border-amber-200 bg-amber-50' : 'border-zinc-200 bg-white'}`}>
              <p className="text-xs text-zinc-500">{s.label}</p>
              <p className={`text-2xl font-semibold mt-0.5 ${s.alert ? 'text-amber-700' : 'text-zinc-900'}`}>{s.value}</p>
            </div>
          ))}
        </div>
        {bouncedByTenant.length > 0 && (
          <div className="mt-3 rounded-xl border border-zinc-200 bg-white p-4">
            <p className="text-xs font-semibold text-zinc-500 mb-2">Top tenants by bounce count</p>
            <div className="space-y-1">
              {bouncedByTenant.map((g) => (
                <div key={g.tenantId} className="flex items-center justify-between text-xs">
                  <Link href={`/admin/tenants/${g.tenantId}`} className="text-blue-600 hover:underline font-mono">
                    {g.tenantId}
                  </Link>
                  <span className="text-zinc-500">{g._count} bounce{g._count === 1 ? '' : 's'}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {emailBounces30d === 0 && emailComplaints30d === 0 && (
          <p className="mt-2 text-xs text-zinc-400">
            No bounce events recorded. Confirm the Resend webhook is configured at{' '}
            <code className="font-mono">/api/webhooks/resend</code>.
          </p>
        )}
      </section>

      {/* Panel 3 — Tenant activity signals */}
      <section>
        <h2 className="text-sm font-semibold text-zinc-900 mb-3">Activity Signals</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Churn signal: no login in 14 days */}
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <p className="text-xs font-semibold text-zinc-500 mb-2">No login in 14+ days ({dormantUsers.length})</p>
            {dormantUsers.length === 0 ? (
              <p className="text-xs text-zinc-400">All tenants have been active recently.</p>
            ) : (
              <div className="space-y-1.5">
                {dormantUsers.map((t) => {
                  const lastSeen = t.users[0]?.lastActiveAt
                  return (
                    <div key={t.id} className="flex items-center justify-between text-xs">
                      <Link href={`/admin/tenants/${t.id}`} className="text-blue-600 hover:underline truncate max-w-[60%]">{t.name}</Link>
                      <span className="text-zinc-400">{lastSeen ? new Date(lastSeen).toLocaleDateString() : 'never'}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          {/* Activation signal: no deals in 30 days */}
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <p className="text-xs font-semibold text-zinc-500 mb-2">No deals created (30d), account 30d+ old ({zeroDealsLast30d.length})</p>
            {zeroDealsLast30d.length === 0 ? (
              <p className="text-xs text-zinc-400">All mature tenants have created deals recently.</p>
            ) : (
              <div className="space-y-1.5">
                {zeroDealsLast30d.map((t) => (
                  <div key={t.id} className="flex items-center justify-between text-xs">
                    <Link href={`/admin/tenants/${t.id}`} className="text-blue-600 hover:underline truncate max-w-[60%]">{t.name}</Link>
                    <span className="text-zinc-400">joined {new Date(t.createdAt).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

function RetryForm({ jobId }: { jobId: string }) {
  return (
    <form action={`/api/admin/jobs/${jobId}/retry`} method="POST">
      <button
        type="submit"
        className="mt-1 text-xs text-blue-600 hover:underline"
      >
        Retry
      </button>
    </form>
  )
}
