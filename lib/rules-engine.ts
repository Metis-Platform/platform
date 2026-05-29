/**
 * rules-engine.ts
 *
 * Core rule evaluation service for Metis Platform.
 *
 * generateEventsForDeal(dealId, tenantId):
 *   Loads the deal's jurisdiction rules, calculates deadline dates from the
 *   tax lien's anchor field (e.g. issueDate), and upserts Event rows.
 *
 * Only events with a non-null ruleId are managed here — manually created
 * events (ruleId IS NULL) are never touched.
 */

import { db } from '@/lib/db'
import { calculateEventDueDate } from '@/lib/business-days'
import { EventStatus, StrategyType } from '@/app/generated/prisma'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Fields on DealTaxLien that rules can use as an anchor. */
type TaxLienAnchorField = 'issueDate' | 'saleDate'

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * (Re-)generate all rule-derived Events for a deal.
 *
 * Safe to call multiple times — existing rule-derived events are deleted and
 * recreated from the current rule set. Manual events are untouched.
 *
 * @returns The number of events created.
 */
export async function generateEventsForDeal(dealId: string, tenantId: string): Promise<number> {
  // Load deal with everything we need in one query
  const deal = await db.deal.findUnique({
    where: { id: dealId, tenantId },
    include: {
      taxLien: true,
      property: {
        include: {
          jurisdiction: {
            include: {
              ruleSets: {
                where: { isActive: true },
                include: {
                  rules: { orderBy: { sortOrder: 'asc' } },
                },
                take: 1,
              },
            },
          },
        },
      },
    },
  })

  if (!deal) {
    throw new Error(`Deal ${dealId} not found or not accessible`)
  }

  // Only TAX_LIEN / TAX_DEED strategies are supported in Phase 1
  if (deal.strategyType !== StrategyType.TAX_LIEN && deal.strategyType !== StrategyType.TAX_DEED) {
    return 0
  }

  if (!deal.taxLien) {
    // Deal exists but DealTaxLien extension hasn't been created yet — skip silently
    return 0
  }

  const activeRuleSet = deal.property.jurisdiction.ruleSets[0]
  if (!activeRuleSet || activeRuleSet.rules.length === 0) {
    return 0
  }

  // Delete only rule-derived events (ruleId IS NOT NULL) to preserve manual events
  await db.event.deleteMany({
    where: { dealId, ruleId: { not: null } },
  })

  const now = new Date()
  const eventsToCreate = []

  for (const rule of activeRuleSet.rules) {
    const anchorField = rule.anchorField as TaxLienAnchorField
    const anchorValue = deal.taxLien[anchorField] as Date | null

    if (!anchorValue) {
      // Rule requires a field that hasn't been set on this deal yet — skip
      continue
    }

    const dueDate = calculateEventDueDate(anchorValue, rule.offsetDays)
    const status: EventStatus = dueDate < now ? EventStatus.OVERDUE : EventStatus.PENDING

    eventsToCreate.push({
      dealId,
      ruleId: rule.id,
      eventType: rule.eventType,
      label: rule.label,
      dueDate,
      status,
    })
  }

  if (eventsToCreate.length > 0) {
    await db.event.createMany({ data: eventsToCreate })
  }

  return eventsToCreate.length
}

/**
 * Refresh Event statuses for all active deals belonging to a tenant.
 *
 * Marks PENDING events as OVERDUE when their dueDate has passed.
 * Called by the nightly cron sweep — does NOT regenerate events, only updates
 * statuses to reflect the passage of time.
 *
 * @returns Count of events transitioned to OVERDUE.
 */
export async function refreshEventStatuses(tenantId?: string): Promise<number> {
  const now = new Date()

  // Build the where clause
  const where = {
    status: EventStatus.PENDING,
    dueDate: { lt: now },
    ...(tenantId
      ? { deal: { tenantId } }
      : {}),
  }

  const result = await db.event.updateMany({
    where,
    data: { status: EventStatus.OVERDUE },
  })

  return result.count
}
