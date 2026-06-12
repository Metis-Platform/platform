import type { ChecklistTemplate, DueAnchor } from './types'

/** Minimal deal shape the instantiator needs — avoids importing full Prisma types in tests. */
export interface DealAnchorFields {
  purchaseDate?: Date | null
  // strategy extension anchor fields (all optional — resolved at call site)
  auctionDate?: Date | null
  issueDate?: Date | null
  redemptionDeadline?: Date | null
  foreclosureEligibleDate?: Date | null
  saleDate?: Date | null
}

/** What already exists in the DB for this deal (for idempotency). */
export interface ExistingChecklistTask {
  checklistKey: string
}

/** What the instantiator produces — caller decides how to persist. */
export interface ChecklistTaskSpec {
  checklistKey: string
  title: string
  description: string | undefined
  taskType: string
  priority: string
  dueDate: Date | null
}

/**
 * Resolve a due-date anchor to an actual Date from the deal's fields.
 * Returns null when the anchor field is absent or null on the deal.
 */
function resolveAnchor(anchor: DueAnchor, deal: DealAnchorFields): Date | null {
  switch (anchor) {
    case 'auctionDate':           return deal.auctionDate ?? null
    case 'issueDate':             return deal.issueDate ?? null
    case 'redemptionDeadline':    return deal.redemptionDeadline ?? null
    case 'foreclosureEligibleDate': return deal.foreclosureEligibleDate ?? null
    case 'saleDate':              return deal.saleDate ?? null
    case 'purchaseDate':          return deal.purchaseDate ?? null
  }
}

/**
 * Compute task specs for items that are NOT yet in the DB.
 * Idempotency: items whose `checklistKey` already exists in `existing` are skipped.
 *
 * @param template - The checklist template to instantiate.
 * @param deal     - Anchor date fields from the deal + its extension record.
 * @param existing - Tasks already created from this template (checklistKey list).
 * @returns Array of task specs that need to be created.
 */
export function computeMissingItems(
  template: ChecklistTemplate,
  deal: DealAnchorFields,
  existing: ExistingChecklistTask[],
): ChecklistTaskSpec[] {
  const existingKeys = new Set(existing.map(t => t.checklistKey))

  return template.items
    .filter(item => !existingKeys.has(item.key))
    .map(item => {
      let dueDate: Date | null = null
      if (item.dueAnchor) {
        const anchor = resolveAnchor(item.dueAnchor, deal)
        if (anchor) {
          dueDate = new Date(anchor.getTime() + (item.dueOffsetDays ?? 0) * 86_400_000)
        }
      }
      return {
        checklistKey: item.key,
        title: item.title,
        description: item.description,
        taskType: item.taskType,
        priority: item.defaultPriority,
        dueDate,
      }
    })
}

/**
 * Derive progress from a flat list of tasks that have a checklistKey.
 * Returns { completed, total } for the progress chip.
 */
export function checklistProgress(tasks: { checklistKey: string | null; status: string }[]): {
  completed: number
  total: number
} {
  const generated = tasks.filter(t => t.checklistKey !== null)
  return {
    completed: generated.filter(t => t.status === 'COMPLETED').length,
    total: generated.length,
  }
}
