import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, hasRole } from '@/lib/auth'
import { db } from '@/lib/db'
import { getTemplate } from '@/lib/checklists/registry'
import { computeMissingItems } from '@/lib/checklists/instantiate'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await getCurrentUser()
  if (!result) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasRole(result.user.role, 'ANALYST')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  const { tenant } = result

  const { id: dealId } = await params

  const deal = await db.deal.findUnique({
    where: { id: dealId, tenantId: tenant.id },
    include: {
      taxLien:     true,
      taxDeed:     true,
      foreclosure: true,
      land:        true,
    },
  })
  if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })

  const template = getTemplate(deal.strategyType)
  if (!template) {
    return NextResponse.json({ error: 'No checklist template for this strategy' }, { status: 422 })
  }

  // Build a flat anchor-fields object from the deal + its extension record
  const ext = deal.taxLien ?? deal.taxDeed ?? deal.foreclosure
  const anchorFields = {
    purchaseDate:            deal.purchaseDate ?? null,
    auctionDate:             ext && 'auctionDate' in ext ? (ext.auctionDate ?? null) : null,
    issueDate:               deal.taxLien?.issueDate ?? null,
    redemptionDeadline:      ext && 'redemptionDeadline' in ext ? ((ext as { redemptionDeadline?: Date | null }).redemptionDeadline ?? null) : null,
    foreclosureEligibleDate: deal.taxLien?.foreclosureEligibleDate ?? null,
    saleDate:                deal.taxDeed?.saleDate ?? null,
    optionExpiry:            deal.land?.optionExpiry ?? null,
  }

  // Fetch existing checklist tasks for idempotency check
  const existing = await db.task.findMany({
    where: { dealId, tenantId: tenant.id, checklistKey: { not: null } },
    select: { checklistKey: true },
  })
  const existingTyped = existing.map(t => ({ checklistKey: t.checklistKey! }))

  const toCreate = computeMissingItems(template, anchorFields, existingTyped)

  if (toCreate.length === 0) {
    return NextResponse.json({ created: 0, message: 'All checklist items already exist' })
  }

  await db.task.createMany({
    data: toCreate.map(spec => ({
      dealId,
      tenantId: tenant.id,
      checklistKey: spec.checklistKey,
      title:        spec.title,
      description:  spec.description ?? null,
      taskType:     spec.taskType as Parameters<typeof db.task.create>[0]['data']['taskType'],
      priority:     spec.priority as Parameters<typeof db.task.create>[0]['data']['priority'],
      dueDate:      spec.dueDate ?? null,
      status:       'OPEN' as const,
    })),
  })

  return NextResponse.json({ created: toCreate.length }, { status: 201 })
}
