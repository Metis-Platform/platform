'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { auth } from '@clerk/nextjs/server'
import { syncUserToDatabase } from '@/lib/sync-user'
import { db } from '@/lib/db'
import { generateBuyHoldEvents } from '@/lib/buy-hold-events'
import { applyTenantWorkflowRules } from '@/lib/workflow-rules'
import { hasStrategy } from '@/lib/entitlements'

export type BuyHoldFormState = {
  error?: string
  fieldErrors?: Record<string, string>
}

function parseDate(val: string | null): Date | null {
  if (!val) return null
  const d = new Date(val)
  return isNaN(d.getTime()) ? null : d
}

function parseDec(val: string | null): number | null {
  if (!val) return null
  const n = parseFloat(val)
  return isNaN(n) ? null : n
}

function fd(formData: FormData, key: string): string | null {
  return (formData.get(key) as string)?.trim() || null
}

export async function createBuyHold(
  _prev: BuyHoldFormState,
  formData: FormData,
): Promise<BuyHoldFormState> {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return { error: 'Not authenticated' }
  const synced = await syncUserToDatabase()
  if (!synced) return { error: 'Tenant not found' }
  const { tenant } = synced
  if (!await hasStrategy(tenant.id, 'BUY_HOLD')) return { error: 'Buy & Hold strategy is not enabled for your account.' }

  const apn            = fd(formData, 'apn')
  const address        = fd(formData, 'address')
  const jurisdictionId = fd(formData, 'jurisdictionId')

  if (!apn)            return { fieldErrors: { apn: 'APN is required' } }
  if (!jurisdictionId) return { fieldErrors: { jurisdictionId: 'Jurisdiction is required' } }

  const purchasePrice      = parseDec(fd(formData, 'purchasePrice'))
  const purchaseDate       = parseDate(fd(formData, 'purchaseDate'))
  const rentalStrategy     = fd(formData, 'rentalStrategy')
  const targetMonthlyRent  = parseDec(fd(formData, 'targetMonthlyRent'))
  const actualMonthlyRent  = parseDec(fd(formData, 'actualMonthlyRent'))
  const securityDeposit    = parseDec(fd(formData, 'securityDeposit'))
  const leaseStartDate     = parseDate(fd(formData, 'leaseStartDate'))
  const leaseEndDate       = parseDate(fd(formData, 'leaseEndDate'))
  const tenantName         = fd(formData, 'tenantName')
  const tenantPhone        = fd(formData, 'tenantPhone')
  const tenantEmail        = fd(formData, 'tenantEmail')
  const propertyManagerName  = fd(formData, 'propertyManagerName')
  const propertyManagerPhone = fd(formData, 'propertyManagerPhone')
  const propertyManagerEmail = fd(formData, 'propertyManagerEmail')
  const maintenanceReserve = parseDec(fd(formData, 'maintenanceReserve'))
  const notes              = fd(formData, 'notes')

  const dealStatus = purchaseDate ? 'ACTIVE' : 'LEAD'

  const jur = await db.jurisdiction.findUnique({ where: { id: jurisdictionId } })
  if (!jur) return { fieldErrors: { jurisdictionId: 'Jurisdiction not found' } }

  const property = await db.property.create({
    data: { tenantId: tenant.id, apn, address, jurisdictionId },
  })

  const deal = await db.deal.create({
    data: {
      tenantId: tenant.id,
      propertyId: property.id,
      strategyType: 'BUY_HOLD',
      status: dealStatus,
      purchasePrice,
      purchaseDate,
      notes,
      buyHold: {
        create: {
          rentalStrategy,
          targetMonthlyRent,
          actualMonthlyRent,
          securityDeposit,
          leaseStartDate,
          leaseEndDate,
          tenantName,
          tenantPhone,
          tenantEmail,
          propertyManagerName,
          propertyManagerPhone,
          propertyManagerEmail,
          maintenanceReserve,
        },
      },
    },
  })

  await generateBuyHoldEvents(deal.id)
  await applyTenantWorkflowRules(tenant.id, deal.id)
  redirect(`/dashboard/deals/${deal.id}`)
}

export async function updateBuyHold(
  dealId: string,
  _prev: BuyHoldFormState,
  formData: FormData,
): Promise<BuyHoldFormState> {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return { error: 'Not authenticated' }
  const synced = await syncUserToDatabase()
  if (!synced) return { error: 'Tenant not found' }
  const { tenant } = synced

  const deal = await db.deal.findUnique({ where: { id: dealId, tenantId: tenant.id } })
  if (!deal) return { error: 'Deal not found' }

  const purchasePrice      = parseDec(fd(formData, 'purchasePrice'))
  const purchaseDate       = parseDate(fd(formData, 'purchaseDate'))
  const rentalStrategy     = fd(formData, 'rentalStrategy')
  const targetMonthlyRent  = parseDec(fd(formData, 'targetMonthlyRent'))
  const actualMonthlyRent  = parseDec(fd(formData, 'actualMonthlyRent'))
  const securityDeposit    = parseDec(fd(formData, 'securityDeposit'))
  const leaseStartDate     = parseDate(fd(formData, 'leaseStartDate'))
  const leaseEndDate       = parseDate(fd(formData, 'leaseEndDate'))
  const tenantName         = fd(formData, 'tenantName')
  const tenantPhone        = fd(formData, 'tenantPhone')
  const tenantEmail        = fd(formData, 'tenantEmail')
  const propertyManagerName  = fd(formData, 'propertyManagerName')
  const propertyManagerPhone = fd(formData, 'propertyManagerPhone')
  const propertyManagerEmail = fd(formData, 'propertyManagerEmail')
  const inspectionStatus   = fd(formData, 'inspectionStatus')
  const maintenanceReserve = parseDec(fd(formData, 'maintenanceReserve'))
  const notes              = fd(formData, 'notes')

  await db.$transaction(async tx => {
    await tx.deal.update({
      where: { id: dealId },
      data: { purchasePrice, purchaseDate, notes },
    })
    await tx.dealBuyHold.upsert({
      where: { dealId },
      create: {
        dealId,
        rentalStrategy,
        targetMonthlyRent,
        actualMonthlyRent,
        securityDeposit,
        leaseStartDate,
        leaseEndDate,
        tenantName,
        tenantPhone,
        tenantEmail,
        propertyManagerName,
        propertyManagerPhone,
        propertyManagerEmail,
        inspectionStatus,
        maintenanceReserve,
      },
      update: {
        rentalStrategy,
        targetMonthlyRent,
        actualMonthlyRent,
        securityDeposit,
        leaseStartDate,
        leaseEndDate,
        tenantName,
        tenantPhone,
        tenantEmail,
        propertyManagerName,
        propertyManagerPhone,
        propertyManagerEmail,
        inspectionStatus,
        maintenanceReserve,
      },
    })
  })

  await generateBuyHoldEvents(dealId)
  revalidatePath(`/dashboard/deals/${dealId}`)
  redirect(`/dashboard/deals/${dealId}`)
}
