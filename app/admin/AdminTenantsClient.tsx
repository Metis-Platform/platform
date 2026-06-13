'use client'

import { useState } from 'react'

type ModuleRow = { strategy: string; tier: string }

type TenantRow = {
  id: string
  name: string
  slug: string
  plan: string
  stripeSubscriptionStatus: string | null
  trialEndsAt: Date | null
  currentPeriodEnd: Date | null
  dealCount: number
  userCount: number
  mrr: number
  lastActive: Date | null
  createdAt: Date
  modules: ModuleRow[]
}

const PLANS = ['STARTER', 'PROFESSIONAL', 'TEAM', 'ENTERPRISE']

const CREATABLE_STRATEGIES = ['TAX_LIEN', 'TAX_DEED', 'FORECLOSURE', 'FIX_FLIP', 'WHOLESALE', 'BUY_HOLD', 'LAND']

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  trialing: 'bg-blue-100 text-blue-700',
  past_due: 'bg-red-100 text-red-700',
  canceled: 'bg-zinc-100 text-zinc-500',
}

export default function AdminTenantsClient({ rows: initial }: { rows: TenantRow[] }) {
  const [rows, setRows] = useState(initial)
  const [changingPlan, setChangingPlan] = useState<string | null>(null)
  const [changingModule, setChangingModule] = useState<string | null>(null)
  const [expandedTenant, setExpandedTenant] = useState<string | null>(null)

  async function changePlan(tenantId: string, plan: string) {
    setChangingPlan(tenantId)
    const res = await fetch(`/api/admin/tenants/${tenantId}/plan`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    })
    if (res.ok) {
      setRows((prev) => prev.map((r) => (r.id === tenantId ? { ...r, plan } : r)))
    }
    setChangingPlan(null)
  }

  async function grantModule(tenantId: string, strategy: string) {
    setChangingModule(`${tenantId}:${strategy}`)
    const res = await fetch(`/api/admin/tenants/${tenantId}/modules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ strategy, tier: 'STANDARD' }),
    })
    if (res.ok) {
      setRows((prev) => prev.map((r) => {
        if (r.id !== tenantId) return r
        const existing = r.modules.find(m => m.strategy === strategy)
        if (existing) return r
        return { ...r, modules: [...r.modules, { strategy, tier: 'STANDARD' }] }
      }))
    }
    setChangingModule(null)
  }

  async function revokeModule(tenantId: string, strategy: string) {
    setChangingModule(`${tenantId}:${strategy}`)
    const res = await fetch(`/api/admin/tenants/${tenantId}/modules`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ strategy }),
    })
    if (res.ok) {
      setRows((prev) => prev.map((r) => {
        if (r.id !== tenantId) return r
        return { ...r, modules: r.modules.filter(m => m.strategy !== strategy) }
      }))
    }
    setChangingModule(null)
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 border-b border-zinc-200">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-zinc-600">Tenant</th>
            <th className="text-left px-4 py-3 font-medium text-zinc-600">Plan</th>
            <th className="text-left px-4 py-3 font-medium text-zinc-600">Status</th>
            <th className="text-right px-4 py-3 font-medium text-zinc-600">Deals</th>
            <th className="text-right px-4 py-3 font-medium text-zinc-600">Users</th>
            <th className="text-right px-4 py-3 font-medium text-zinc-600">MRR</th>
            <th className="text-left px-4 py-3 font-medium text-zinc-600">Last active</th>
            <th className="text-left px-4 py-3 font-medium text-zinc-600">Modules</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {rows.map((r) => (
            <>
              <tr key={r.id} className="hover:bg-zinc-50">
                <td className="px-4 py-3">
                  <div className="font-medium text-zinc-900">{r.name}</div>
                  <div className="text-xs text-zinc-400">{r.slug}</div>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={r.plan}
                    disabled={changingPlan === r.id}
                    onChange={(e) => changePlan(r.id, e.target.value)}
                    className="border border-zinc-300 rounded px-2 py-1 text-xs disabled:opacity-50"
                  >
                    {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3">
                  {r.stripeSubscriptionStatus ? (
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[r.stripeSubscriptionStatus] ?? 'bg-zinc-100 text-zinc-600'}`}>
                      {r.stripeSubscriptionStatus}
                    </span>
                  ) : (
                    <span className="text-xs text-zinc-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-zinc-700">{r.dealCount}</td>
                <td className="px-4 py-3 text-right text-zinc-700">{r.userCount}</td>
                <td className="px-4 py-3 text-right font-medium text-zinc-900">
                  {r.mrr ? `$${r.mrr}` : '—'}
                </td>
                <td className="px-4 py-3 text-zinc-500 text-xs">
                  {r.lastActive ? new Date(r.lastActive).toLocaleDateString() : '—'}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => setExpandedTenant(expandedTenant === r.id ? null : r.id)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    {r.modules.length} modules {expandedTenant === r.id ? '▲' : '▼'}
                  </button>
                </td>
              </tr>
              {expandedTenant === r.id && (
                <tr key={`${r.id}-modules`} className="bg-zinc-50">
                  <td colSpan={8} className="px-6 py-4">
                    <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">Module Access</div>
                    <div className="flex flex-wrap gap-2">
                      {CREATABLE_STRATEGIES.map(strategy => {
                        const enabled = r.modules.some(m => m.strategy === strategy)
                        const key = `${r.id}:${strategy}`
                        return (
                          <button
                            key={strategy}
                            disabled={changingModule === key}
                            onClick={() => enabled ? revokeModule(r.id, strategy) : grantModule(r.id, strategy)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
                              enabled
                                ? 'bg-emerald-100 text-emerald-700 hover:bg-red-100 hover:text-red-700'
                                : 'bg-zinc-100 text-zinc-500 hover:bg-emerald-100 hover:text-emerald-700'
                            }`}
                            title={enabled ? `Revoke ${strategy}` : `Grant ${strategy}`}
                          >
                            {strategy.replace(/_/g, ' ')} {enabled ? '✓' : '+'}
                          </button>
                        )
                      })}
                    </div>
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  )
}
