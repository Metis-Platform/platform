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

  await db.$transaction(async (tx) => {
    // Deactivate all other rulesets for this jurisdiction
    await tx.ruleSet.updateMany({
      where: { jurisdictionId },
      data: { isActive: false },
    })
    // Activate this one
    await tx.ruleSet.update({
      where: { id: ruleSetId },
      data: { isActive: true },
    })
    // Mark jurisdiction as available for deal creation
    await tx.jurisdiction.update({
      where: { id: jurisdictionId },
      data: { isAvailable: true },
    })
  })

  revalidatePath(`/admin/rules/${jurisdictionId}`)
  revalidatePath('/admin/rules')
}

export async function deactivateRuleSet(ruleSetId: string, jurisdictionId: string) {
  await assertSuperAdmin()

  await db.$transaction(async (tx) => {
    await tx.ruleSet.update({
      where: { id: ruleSetId },
      data: { isActive: false },
    })
    // If no remaining active rulesets, mark jurisdiction unavailable
    const remaining = await tx.ruleSet.count({
      where: { jurisdictionId, isActive: true },
    })
    if (remaining === 0) {
      await tx.jurisdiction.update({
        where: { id: jurisdictionId },
        data: { isAvailable: false },
      })
    }
  })

  revalidatePath(`/admin/rules/${jurisdictionId}`)
  revalidatePath('/admin/rules')
}

export async function toggleJurisdictionAvailable(
  jurisdictionId: string,
  isAvailable: boolean
) {
  await assertSuperAdmin()

  await db.jurisdiction.update({
    where: { id: jurisdictionId },
    data: { isAvailable },
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

// ─── Bulk apply ───────────────────────────────────────────────────────────────

/**
 * Copies the given ruleset (name + all rules) to every jurisdiction in the
 * same state that currently has no active ruleset, then activates each copy.
 * Returns the number of jurisdictions that were updated.
 */
export async function bulkApplyRuleSet(
  sourceRuleSetId: string
): Promise<{ applied: number }> {
  await assertSuperAdmin()

  const source = await db.ruleSet.findUnique({
    where: { id: sourceRuleSetId },
    include: {
      rules: true,
      jurisdiction: { select: { id: true, state: true } },
    },
  })
  if (!source) throw new Error('Source ruleset not found')

  const { state, id: sourceJurisdictionId } = source.jurisdiction

  // Targets: same state, no active ruleset, not the source jurisdiction itself
  const targets = await db.jurisdiction.findMany({
    where: {
      state,
      id: { not: sourceJurisdictionId },
      ruleSets: { none: { isActive: true } },
    },
    select: { id: true, county: true, state: true },
  })

  if (targets.length === 0) return { applied: 0 }

  const ruleData = source.rules.map((r) => ({
    eventType: r.eventType,
    label: r.label,
    anchorField: r.anchorField,
    offsetDays: r.offsetDays,
    sortOrder: r.sortOrder,
    description: r.description,
  }))

  // Extract the suffix portion of the source name (the part after "—" if present),
  // e.g. "Maricopa County AZ — Standard Tax Lien Rules" → "Standard Tax Lien Rules"
  const sourceSuffix = source.name.includes('—')
    ? source.name.split('—').slice(1).join('—').trim()
    : source.name

  for (const target of targets) {
    const targetName = `${target.county} County ${target.state} — ${sourceSuffix}`
    await db.$transaction(async (tx) => {
      await tx.ruleSet.create({
        data: {
          jurisdictionId: target.id,
          name: targetName,
          effectiveDate: source.effectiveDate,
          isActive: true,
          rules: { createMany: { data: ruleData } },
        },
      })
      // Mark each target jurisdiction as available now that it has an active ruleset
      await tx.jurisdiction.update({
        where: { id: target.id },
        data: { isAvailable: true },
      })
    })
  }

  revalidatePath('/admin/rules')
  revalidatePath(`/admin/rules/${sourceJurisdictionId}`)

  return { applied: targets.length }
}
