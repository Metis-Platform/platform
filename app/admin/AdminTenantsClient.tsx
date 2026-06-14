'use client'

import { useState } from 'react'
import Link from 'next/link'

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

const CREATABLE_STRATEGIES = [
  'TAX_LIEN', 'TAX_DEED', 'FORECLOSURE', 'FIX_FLIP', 'WHOLESALE', 'BUY_HOLD', 'LAND', 'MULTIFAMILY',
]

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  trialing: 'bg-blue-100 text-blue-700',
  past_due: 'bg-red-100 text-red-700',
  canceled: 'bg-zinc-100 text-zinc-500',
}

export default function AdminTenantsClient({ rows: initial }: { rows: TenantRow[] }) {
  const [rows, setRows] = useState(initial)
  const [changingModule, setChangingModule] = useState<string | null>(null)
  const [expandedTenant, setExpandedTenant] = useState<string | null>(null)

  async function setModuleTier(tenantId: string, strategy: string, tier: string | null) {
    const key = `${tenantId}:${strategy}`
    setChangingModule(key)

    if (tier === null) {
      const res = await fetch(`/api/admin/tenants/${tenantId}/modules`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategy }),
      })
      if (res.ok) {
        setRows((prev) => prev.map((r) => {
          if (r.id !== tenantId) return r
          return { ...r, modules: r.modules.filter((m) => m.strategy !== strategy) }
        }))
      }
    } else {
      const res = await fetch(`/api/admin/tenants/${tenantId}/modules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategy, tier }),
      })
      if (res.ok) {
        setRows((prev) => prev.map((r) => {
          if (r.id !== tenantId) return r
          const existing = r.modules.find((m) => m.strategy === strategy)
          if (existing) {
            return { ...r, modules: r.modules.map((m) => m.strategy === strategy ? { ...m, tier } : m) }
          }
          return { ...r, modules: [...r.modules, { strategy, tier }] }
        }))
      }
    }
    setChangingModule(null)
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 border-b border-zinc-200">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-zinc-600">Tenant</th>
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
                  <Link href={`/admin/tenants/${r.id}`} className="font-medium text-zinc-900 hover:text-blue-700 hover:underline">
                    {r.name}
                  </Link>
                  <div className="text-xs text-zinc-400">{r.slug}</div>
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
                  <td colSpan={7} className="px-6 py-4">
                    <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">Module Access</div>
                    <div className="flex flex-wrap gap-2">
                      {CREATABLE_STRATEGIES.map((strategy) => {
                        const mod = r.modules.find((m) => m.strategy === strategy)
                        const key = `${r.id}:${strategy}`
                        const busy = changingModule === key
                        const label = strategy.replace(/_/g, ' ')

                        return (
                          <div key={strategy} className="flex items-center gap-1.5 border border-zinc-200 rounded-lg px-2 py-1.5 bg-white">
                            <span className="text-xs text-zinc-600 w-24 truncate">{label}</span>
                            {mod ? (
                              <>
                                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                                  mod.tier === 'PREMIUM' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                                }`}>
                                  {mod.tier === 'PREMIUM' ? 'PRE' : 'STD'}
                                </span>
                                {mod.tier === 'STANDARD' ? (
                                  <button
                                    disabled={busy}
                                    onClick={() => setModuleTier(r.id, strategy, 'PREMIUM')}
                                    className="text-xs text-amber-600 hover:underline disabled:opacity-50"
                                    title="Upgrade to Premium"
                                  >↑PRE</button>
                                ) : (
                                  <button
                                    disabled={busy}
                                    onClick={() => setModuleTier(r.id, strategy, 'STANDARD')}
                                    className="text-xs text-zinc-500 hover:underline disabled:opacity-50"
                                    title="Downgrade to Standard"
                                  >↓STD</button>
                                )}
                                <button
                                  disabled={busy}
                                  onClick={() => setModuleTier(r.id, strategy, null)}
                                  className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50 ml-1"
                                  title="Revoke"
                                >×</button>
                              </>
                            ) : (
                              <>
                                <button
                                  disabled={busy}
                                  onClick={() => setModuleTier(r.id, strategy, 'STANDARD')}
                                  className="text-xs px-1.5 py-0.5 rounded border border-zinc-200 text-zinc-500 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 disabled:opacity-50 transition-colors"
                                >+STD</button>
                                <button
                                  disabled={busy}
                                  onClick={() => setModuleTier(r.id, strategy, 'PREMIUM')}
                                  className="text-xs px-1.5 py-0.5 rounded border border-zinc-200 text-zinc-500 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200 disabled:opacity-50 transition-colors"
                                >+PRE</button>
                              </>
                            )}
                          </div>
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
