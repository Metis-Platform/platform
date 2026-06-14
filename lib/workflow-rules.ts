import { db } from '@/lib/db'
import { TaskType, Priority } from '@/app/generated/prisma'

type RuleActionConfig = {
  taskTitle?: string
  taskType?: string
  priority?: string
}

export async function applyTenantWorkflowRules(tenantId: string, dealId: string): Promise<void> {
  const deal = await db.deal.findUnique({
    where: { id: dealId, tenantId },
    select: {
      strategyType: true,
      events: { select: { eventType: true, dueDate: true } },
    },
  })
  if (!deal) return

  const rules = await db.tenantWorkflowRule.findMany({
    where: { tenantId, strategy: deal.strategyType, isActive: true },
  })
  if (rules.length === 0) return

  const eventsMap: Record<string, Date> = {}
  for (const e of deal.events) eventsMap[e.eventType] = e.dueDate

  const tasksToCreate: {
    dealId: string
    tenantId: string
    title: string
    taskType: TaskType
    priority: Priority
    dueDate: Date
  }[] = []

  for (const rule of rules) {
    if (rule.action !== 'CREATE_TASK') continue
    const triggerDate = eventsMap[rule.triggerEvent]
    if (!triggerDate) continue

    const dueDate = new Date(triggerDate.getTime() + rule.offsetDays * 24 * 60 * 60 * 1000)
    const config = rule.actionConfig as RuleActionConfig

    const taskType = (config.taskType as TaskType) ?? TaskType.CUSTOM
    const priority = (config.priority as Priority) ?? Priority.MEDIUM

    tasksToCreate.push({
      dealId,
      tenantId,
      title: config.taskTitle ?? rule.name,
      taskType,
      priority,
      dueDate,
    })
  }

  if (tasksToCreate.length > 0) {
    await db.task.createMany({ data: tasksToCreate })
  }
}
