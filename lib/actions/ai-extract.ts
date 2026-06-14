'use server'

import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import type { ScopeOfWork } from '@/lib/actions/rehab-budget'

export type SowItem = { category: string; description: string; amount: number }

type LienFields = {
  certificateNumber?: string | null
  faceAmount?: string | null
  interestRate?: string | null
  issueDate?: string | null
}

type DeedFields = {
  saleDate?: string | null
  winningBid?: string | null
  openingBid?: string | null
}

export async function applyLienExtraction(
  dealId: string,
  fields: LienFields,
): Promise<{ error?: string }> {
  const result = await getCurrentUser()
  if (!result) return { error: 'Not authenticated.' }
  const { tenant } = result

  try {
    const deal = await db.deal.findUnique({
      where: { id: dealId, tenantId: tenant.id },
      select: { taxLien: { select: { id: true } } },
    })
    if (!deal?.taxLien) return { error: 'Tax lien record not found.' }

    const data: Record<string, unknown> = {}
    if (fields.certificateNumber) data.certificateNumber = fields.certificateNumber
    if (fields.faceAmount) data.faceAmount = parseFloat(fields.faceAmount)
    if (fields.interestRate) data.interestRate = parseFloat(fields.interestRate) / 100
    if (fields.issueDate) data.issueDate = new Date(`${fields.issueDate}T12:00:00.000Z`)

    if (Object.keys(data).length === 0) return { error: 'No fields to apply.' }

    await db.dealTaxLien.update({ where: { dealId }, data })
    return {}
  } catch (err) {
    console.error('[applyLienExtraction]', err)
    return { error: 'Failed to apply fields.' }
  }
}

export async function applyDeedExtraction(
  dealId: string,
  fields: DeedFields,
): Promise<{ error?: string }> {
  const result = await getCurrentUser()
  if (!result) return { error: 'Not authenticated.' }
  const { tenant } = result

  try {
    const deal = await db.deal.findUnique({
      where: { id: dealId, tenantId: tenant.id },
      select: { taxDeed: { select: { id: true } } },
    })
    if (!deal?.taxDeed) return { error: 'Tax deed record not found.' }

    const data: Record<string, unknown> = {}
    if (fields.saleDate) data.saleDate = new Date(`${fields.saleDate}T12:00:00.000Z`)
    if (fields.winningBid) data.winningBid = parseFloat(fields.winningBid)
    if (fields.openingBid) data.openingBid = parseFloat(fields.openingBid)

    if (Object.keys(data).length === 0) return { error: 'No fields to apply.' }

    await db.dealTaxDeed.update({ where: { dealId }, data })
    return {}
  } catch (err) {
    console.error('[applyDeedExtraction]', err)
    return { error: 'Failed to apply fields.' }
  }
}

export async function applyBidExtraction(
  dealId: string,
  items: SowItem[],
): Promise<{ error?: string }> {
  if (items.length === 0) return { error: 'No items to apply.' }

  const result = await getCurrentUser()
  if (!result) return { error: 'Not authenticated.' }
  const { tenant } = result

  try {
    const deal = await db.deal.findUnique({
      where: { id: dealId, tenantId: tenant.id },
      select: { fixFlip: { select: { scopeOfWork: true } } },
    })
    if (!deal?.fixFlip) return { error: 'Fix & Flip record not found.' }

    const existing = deal.fixFlip.scopeOfWork as ScopeOfWork | null
    const existingItems = existing?.items ?? []

    const newItems = items.map(item => ({
      id: Math.random().toString(36).slice(2),
      category: item.category,
      description: item.description,
      budgeted: item.amount,
      actual: null,
      status: 'PENDING' as const,
    }))

    const merged: ScopeOfWork = {
      version: 1,
      items: [...existingItems, ...newItems],
    }

    const totalBudgeted = merged.items.reduce((s, i) => s + i.budgeted, 0)

    await db.dealFixFlip.update({
      where: { dealId },
      data: { scopeOfWork: merged, rehabBudget: totalBudgeted || null },
    })

    return {}
  } catch (err) {
    console.error('[applyBidExtraction]', err)
    return { error: 'Failed to apply items.' }
  }
}
