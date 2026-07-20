import { getCurrentUser, hasRole } from '@/lib/auth'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import WorkflowClient from './WorkflowClient'

export default async function WorkflowSettingsPage() {
  const result = await getCurrentUser()
  if (!result) redirect('/sign-in')
  if (!hasRole(result.user.role, 'OWNER')) redirect('/dashboard')

  const rules = await db.tenantWorkflowRule.findMany({
    where: { tenantId: result.tenant.id },
    orderBy: [{ strategy: 'asc' }, { createdAt: 'asc' }],
  })

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-zinc-900">Workflow Rules</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Automatically create tasks on your deals based on deadline events. Rules run when a deal is activated.
        </p>
      </div>
      <WorkflowClient
        initialRules={rules.map((r) => ({
          id: r.id,
          strategy: r.strategy,
          name: r.name,
          triggerEvent: r.triggerEvent,
          offsetDays: r.offsetDays,
          action: r.action,
          actionConfig: r.actionConfig as Record<string, unknown>,
          isActive: r.isActive,
        }))}
      />
    </div>
  )
}
