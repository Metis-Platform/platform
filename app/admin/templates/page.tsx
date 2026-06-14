import { redirect } from 'next/navigation'
import Link from 'next/link'
import { isSuperAdmin } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import { seedChecklistTemplates } from '@/lib/checklists/seed'
import type { ChecklistItem } from '@/lib/checklists/types'

export default async function TemplatesPage() {
  if (!(await isSuperAdmin())) redirect('/')

  // Seed on first visit if no system templates exist
  const count = await db.checklistTemplate.count({ where: { tenantId: null } })
  if (count === 0) {
    await seedChecklistTemplates()
  }

  const templates = await db.checklistTemplate.findMany({
    where: { tenantId: null },
    orderBy: { strategy: 'asc' },
  })

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <div className="flex items-center gap-2 text-sm text-zinc-400 mb-1">
          <Link href="/admin" className="hover:text-zinc-600">Admin</Link>
          <span>/</span>
          <span className="text-zinc-700">Checklist Templates</span>
        </div>
        <h1 className="text-2xl font-semibold text-zinc-900">Checklist Templates</h1>
        <p className="text-sm text-zinc-400 mt-0.5">System-level templates used when tenants generate a checklist for a deal.</p>
      </div>

      <div className="grid gap-4">
        {templates.map((tpl) => {
          const items = tpl.items as unknown as ChecklistItem[]
          return (
            <div key={tpl.id} className="rounded-xl border border-zinc-200 bg-white p-5 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-sm font-semibold text-zinc-900">{tpl.name}</h2>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${tpl.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-500'}`}>
                    {tpl.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <span className="text-xs text-zinc-400">v{tpl.version}</span>
                </div>
                <p className="text-xs text-zinc-500">{tpl.strategy.replace(/_/g, ' ')} — {items.length} items</p>
                <p className="text-xs text-zinc-400 mt-1">
                  Last updated {new Date(tpl.updatedAt).toLocaleDateString()}
                </p>
              </div>
              <Link
                href={`/admin/templates/${tpl.strategy}`}
                className="flex-shrink-0 px-3 py-1.5 text-sm font-medium text-zinc-700 border border-zinc-300 rounded-lg hover:bg-zinc-50 transition-colors"
              >
                Edit
              </Link>
            </div>
          )
        })}
        {templates.length === 0 && (
          <div className="rounded-xl border border-zinc-200 bg-white p-6 text-center">
            <p className="text-sm text-zinc-400">No templates found. Refresh to initialize from defaults.</p>
          </div>
        )}
      </div>
    </div>
  )
}
