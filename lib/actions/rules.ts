'use server'

import { db } from '@/lib/db'
import { isSuperAdmin } from '@/lib/admin-auth'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { EventType } from '@/app/generated/prisma'

async function assertSuperAdmin() {
  if (!(await isSuperAdmin())) redirect('/')
}

// ─── RuleSet mutations ────────────────────────────────────────────────────────

export async function createRuleSet(
  jurisdictionId: string,
  data: { name: string; effectiveDate: string }
) {
  await assertSuperAdmin()

  await db.ruleSet.create({
    data: {
      jurisdictionId,
      name: data.name.trim(),
      effectiveDate: new Date(data.effectiveDate),
      isActive: false, // activate explicitly after reviewing rules
    },
  })

  revalidatePath(`/admin/rules/${jurisdictionId}`)
  revalidatePath('/admin/rules')
}

export async function activateRuleSet(ruleSetId: string, jurisdictionId: string) {
  await assertSuperAdmin()

  // Deactivate all other rulesets for this jurisdiction, activate this one
  await db.$transaction(async (tx) => {
    await tx.ruleSet.updateMany({
      where: { jurisdictionId },
      data: { isActive: false },
    })
    await tx.ruleSet.update({
      where: { id: ruleSetId },
      data: { isActive: true },
    })
  })

  revalidatePath(`/admin/rules/${jurisdictionId}`)
  revalidatePath('/admin/rules')
}

export async function deactivateRuleSet(ruleSetId: string, jurisdictionId: string) {
  await assertSuperAdmin()

  await db.ruleSet.update({
    where: { id: ruleSetId },
    data: { isActive: false },
  })

  revalidatePath(`/admin/rules/${jurisdictionId}`)
  revalidatePath('/admin/rules')
}

export async function deleteRuleSet(ruleSetId: string, jurisdictionId: string) {
  await assertSuperAdmin()

  // Cascade deletes rules via schema onDelete: Cascade
  await db.ruleSet.delete({ where: { id: ruleSetId } })

  revalidatePath(`/admin/rules/${jurisdictionId}`)
  revalidatePath('/admin/rules')
}

// ─── Rule mutations ───────────────────────────────────────────────────────────

export type RuleFormData = {
  eventType: string
  label: string
  anchorField: string
  offsetDays: number
  sortOrder: number
  description?: string
}

export async function createRule(ruleSetId: string, data: RuleFormData) {
  await assertSuperAdmin()

  const ruleSet = await db.ruleSet.findUnique({
    where: { id: ruleSetId },
    select: { jurisdictionId: true },
  })
  if (!ruleSet) throw new Error('RuleSet not found')

  await db.rule.create({
    data: {
      ruleSetId,
      eventType: data.eventType as EventType,
      label: data.label.trim(),
      anchorField: data.anchorField,
      offsetDays: data.offsetDays,
      sortOrder: data.sortOrder,
      description: data.description?.trim() || null,
    },
  })

  revalidatePath(`/admin/rules/${ruleSet.jurisdictionId}`)
}

export async function updateRule(ruleId: string, data: RuleFormData) {
  await assertSuperAdmin()

  const rule = await db.rule.findUnique({
    where: { id: ruleId },
    select: { ruleSet: { select: { jurisdictionId: true } } },
  })
  if (!rule) throw new Error('Rule not found')

  await db.rule.update({
    where: { id: ruleId },
    data: {
      eventType: data.eventType as EventType,
      label: data.label.trim(),
      anchorField: data.anchorField,
      offsetDays: data.offsetDays,
      sortOrder: data.sortOrder,
      description: data.description?.trim() || null,
    },
  })

  revalidatePath(`/admin/rules/${rule.ruleSet.jurisdictionId}`)
}

export async function deleteRule(ruleId: string, jurisdictionId: string) {
  await assertSuperAdmin()

  await db.rule.delete({ where: { id: ruleId } })

  revalidatePath(`/admin/rules/${jurisdictionId}`)
}
