import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { isSuperAdmin } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import { StrategyType } from '@/app/generated/prisma'
import type { ChecklistItem } from '@/lib/checklists/types'
import TemplateEditor from './TemplateEditor'

export default async function TemplateEditPage({ params }: { params: Promise<{ strategy: string }> }) {
  if (!(await isSuperAdmin())) redirect('/')
  const { strategy } = await params

  const validStrategies = Object.values(StrategyType) as string[]
  if (!validStrategies.includes(strategy)) notFound()

  const tpl = await db.checklistTemplate.findFirst({
    where: { strategy: strategy as StrategyType, tenantId: null },
  })
  if (!tpl) notFound()

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <div className="flex items-center gap-2 text-sm text-zinc-400 mb-1">
          <Link href="/admin" className="hover:text-zinc-600">Admin</Link>
          <span>/</span>
          <Link href="/admin/templates" className="hover:text-zinc-600">Templates</Link>
          <span>/</span>
          <span className="text-zinc-700">{tpl.name}</span>
        </div>
        <h1 className="text-2xl font-semibold text-zinc-900">{tpl.name}</h1>
        <p className="text-sm text-zinc-400 mt-0.5">
          System template · v{tpl.version} · Last updated {new Date(tpl.updatedAt).toLocaleDateString()}
        </p>
      </div>

      <TemplateEditor
        strategy={strategy}
        name={tpl.name}
        isActive={tpl.isActive}
        items={tpl.items as unknown as ChecklistItem[]}
      />
    </div>
  )
}
