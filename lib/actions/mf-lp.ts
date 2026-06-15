'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@clerk/nextjs/server'
import { syncUserToDatabase } from '@/lib/sync-user'
import { db } from '@/lib/db'

export type MfLpFormState = { error?: string; fieldErrors?: Record<string, string> }
export type MfWaterfallFormState = { error?: string }

function fd(formData: FormData, key: string): string | null {
  return (formData.get(key) as string)?.trim() || null
}

function parseDec(v: string | null): number | null {
  if (!v) return null
  const n = parseFloat(v)
  return isNaN(n) ? null : n
}

// ── LP Investor CRUD ─────────────────────────────────────────

export async function createLpInvestor(
  dealId: string,
  _prev: MfLpFormState,
  formData: FormData,
): Promise<MfLpFormState> {
  const { orgId } = await auth()
  if (!orgId) return { error: 'Not authenticated' }
  const synced = await syncUserToDatabase()
  if (!synced) return { error: 'Tenant not found' }
  const { tenant } = synced

  const deal = await db.deal.findUnique({ where: { id: dealId, tenantId: tenant.id, strategyType: 'MULTIFAMILY' } })
  if (!deal) return { error: 'Deal not found' }

  const name = fd(formData, 'name')
  if (!name) return { fieldErrors: { name: 'Name is required' } }

  const committedStr = fd(formData, 'committedAmount')
  const committed = parseDec(committedStr)
  if (!committed || committed <= 0) return { fieldErrors: { committedAmount: 'Committed amount must be > 0' } }

  const funded = parseDec(fd(formData, 'fundedAmount')) ?? 0
  const equityPct = parseDec(fd(formData, 'equityPct'))
  const contactId = fd(formData, 'contactId') || null

  await db.dealMfLpInvestor.create({
    data: {
      dealId,
      tenantId: tenant.id,
      contactId,
      name,
      email: fd(formData, 'email'),
      phone: fd(formData, 'phone'),
      committedAmount: committed,
      fundedAmount: funded,
      equityPct: equityPct != null ? equityPct / 100 : null,
      notes: fd(formData, 'notes'),
    },
  })

  revalidatePath(`/dashboard/deals/${dealId}`)
  return {}
}

export async function updateLpInvestor(
  dealId: string,
  investorId: string,
  _prev: MfLpFormState,
  formData: FormData,
): Promise<MfLpFormState> {
  const { orgId } = await auth()
  if (!orgId) return { error: 'Not authenticated' }
  const synced = await syncUserToDatabase()
  if (!synced) return { error: 'Tenant not found' }
  const { tenant } = synced

  const inv = await db.dealMfLpInvestor.findUnique({ where: { id: investorId, tenantId: tenant.id } })
  if (!inv || inv.dealId !== dealId) return { error: 'Investor not found' }

  const name = fd(formData, 'name')
  if (!name) return { fieldErrors: { name: 'Name is required' } }

  const committed = parseDec(fd(formData, 'committedAmount'))
  if (!committed || committed <= 0) return { fieldErrors: { committedAmount: 'Committed amount must be > 0' } }

  const funded = parseDec(fd(formData, 'fundedAmount')) ?? 0
  const equityPct = parseDec(fd(formData, 'equityPct'))
  const contactId = fd(formData, 'contactId') || null

  await db.dealMfLpInvestor.update({
    where: { id: investorId },
    data: {
      contactId,
      name,
      email: fd(formData, 'email'),
      phone: fd(formData, 'phone'),
      committedAmount: committed,
      fundedAmount: funded,
      equityPct: equityPct != null ? equityPct / 100 : null,
      notes: fd(formData, 'notes'),
    },
  })

  revalidatePath(`/dashboard/deals/${dealId}`)
  return {}
}

export async function deleteLpInvestor(
  dealId: string,
  investorId: string,
  _prev: MfLpFormState,
  _formData: FormData,
): Promise<MfLpFormState> {
  const { orgId } = await auth()
  if (!orgId) return { error: 'Not authenticated' }
  const synced = await syncUserToDatabase()
  if (!synced) return { error: 'Tenant not found' }
  const { tenant } = synced

  const inv = await db.dealMfLpInvestor.findUnique({ where: { id: investorId, tenantId: tenant.id } })
  if (!inv || inv.dealId !== dealId) return { error: 'Investor not found' }

  await db.dealMfLpInvestor.delete({ where: { id: investorId } })
  revalidatePath(`/dashboard/deals/${dealId}`)
  return {}
}

// ── Waterfall params CRUD ────────────────────────────────────

export async function upsertWaterfall(
  dealId: string,
  _prev: MfWaterfallFormState,
  formData: FormData,
): Promise<MfWaterfallFormState> {
  const { orgId } = await auth()
  if (!orgId) return { error: 'Not authenticated' }
  const synced = await syncUserToDatabase()
  if (!synced) return { error: 'Tenant not found' }
  const { tenant } = synced

  const deal = await db.deal.findUnique({ where: { id: dealId, tenantId: tenant.id, strategyType: 'MULTIFAMILY' } })
  if (!deal) return { error: 'Deal not found' }

  const prefRatePct = parseDec(fd(formData, 'preferredReturnRate'))
  if (prefRatePct == null) return { error: 'Preferred return rate is required' }
  const lpSplitPct = parseDec(fd(formData, 'lpSplit'))
  if (lpSplitPct == null) return { error: 'LP split is required' }

  const preferredReturnRate = prefRatePct / 100
  const lpSplit = lpSplitPct / 100
  const gpSplit = 1 - lpSplit

  const promoteHurdlePct = parseDec(fd(formData, 'promoteHurdle'))
  const promoteCarryPct  = parseDec(fd(formData, 'promoteCarry'))
  const promoteHurdle = promoteHurdlePct != null ? promoteHurdlePct / 100 : null
  const promoteCarry  = promoteCarryPct  != null ? promoteCarryPct  / 100 : null

  const raisedDateStr = fd(formData, 'raisedDate')
  const raisedDate = raisedDateStr ? new Date(`${raisedDateStr}T12:00:00.000Z`) : null

  await db.dealMfWaterfall.upsert({
    where: { dealId },
    create: { dealId, tenantId: tenant.id, preferredReturnRate, lpSplit, gpSplit, promoteHurdle, promoteCarry, raisedDate },
    update: { preferredReturnRate, lpSplit, gpSplit, promoteHurdle, promoteCarry, raisedDate },
  })

  revalidatePath(`/dashboard/deals/${dealId}`)
  return {}
}
