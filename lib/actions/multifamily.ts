'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { auth } from '@clerk/nextjs/server'
import { syncUserToDatabase } from '@/lib/sync-user'
import { db } from '@/lib/db'
import { generateMultifamilyEvents } from '@/lib/multifamily-events'
import { applyTenantWorkflowRules } from '@/lib/workflow-rules'
import { emitAuditEvent } from '@/lib/audit'
import { mfUnderwriting } from '@/lib/economics'
import { hasStrategy } from '@/lib/entitlements'

export type MultifamilyFormState = {
  error?: string
  fieldErrors?: Record<string, string>
}

function fd(formData: FormData, key: string): string | null {
  return (formData.get(key) as string)?.trim() || null
}

function parseDec(val: string | null): number | null {
  if (!val) return null
  const n = parseFloat(val)
  return isNaN(n) ? null : n
}

function parseInt2(val: string | null): number | null {
  if (!val) return null
  const n = parseInt(val, 10)
  return isNaN(n) ? null : n
}

function parseDate(val: string | null): Date | null {
  if (!val) return null
  const d = new Date(val)
  return isNaN(d.getTime()) ? null : d
}

function computeDerivedFields(params: {
  unitCount: number | null
  averageMonthlyRent: number | null
  vacancyRate: number | null
  annualOpex: number | null
  purchasePrice: number | null
  loanAmount: number | null
  interestRate: number | null
  amortizationYears: number | null
}) {
  const { unitCount, averageMonthlyRent, vacancyRate, annualOpex, purchasePrice, loanAmount, interestRate, amortizationYears } = params
  if (!unitCount || !averageMonthlyRent) return null

  return mfUnderwriting({
    unitCount,
    averageMonthlyRent,
    vacancyRate: vacancyRate ?? 0,
    annualOpex: annualOpex ?? 0,
    purchasePrice,
    loanAmount,
    interestRate,
    amortizationYears,
  })
}

export async function createMultifamily(
  _prev: MultifamilyFormState,
  formData: FormData,
): Promise<MultifamilyFormState> {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return { error: 'Not authenticated' }
  const synced = await syncUserToDatabase()
  if (!synced) return { error: 'Tenant not found' }
  const { tenant } = synced
  if (!await hasStrategy(tenant.id, 'MULTIFAMILY')) return { error: 'Multifamily strategy is not enabled for your account.' }

  const apn            = fd(formData, 'apn')
  const address        = fd(formData, 'address')
  const jurisdictionId = fd(formData, 'jurisdictionId')

  if (!apn)            return { fieldErrors: { apn: 'APN is required' } }
  if (!jurisdictionId) return { fieldErrors: { jurisdictionId: 'Jurisdiction is required' } }

  const jur = await db.jurisdiction.findUnique({ where: { id: jurisdictionId } })
  if (!jur) return { fieldErrors: { jurisdictionId: 'Jurisdiction not found' } }

  const purchasePrice     = parseDec(fd(formData, 'purchasePrice'))
  const purchaseDate      = parseDate(fd(formData, 'purchaseDate'))
  const unitCount         = parseInt2(fd(formData, 'unitCount'))
  const averageMonthlyRent = parseDec(fd(formData, 'averageMonthlyRent'))
  const vacancyRatePct    = parseDec(fd(formData, 'vacancyRate'))
  const vacancyRate       = vacancyRatePct != null ? vacancyRatePct / 100 : null
  const annualOpex        = parseDec(fd(formData, 'annualOpex'))
  const loanAmount        = parseDec(fd(formData, 'loanAmount'))
  const interestRatePct   = parseDec(fd(formData, 'interestRate'))
  const interestRate      = interestRatePct != null ? interestRatePct / 100 : null
  const amortizationYears = parseInt2(fd(formData, 'amortizationYears'))
  const loanMaturityDate  = parseDate(fd(formData, 'loanMaturityDate'))
  const notes             = fd(formData, 'notes')

  const derived = computeDerivedFields({
    unitCount, averageMonthlyRent, vacancyRate, annualOpex: annualOpex,
    purchasePrice, loanAmount, interestRate, amortizationYears,
  })

  const dealStatus = purchaseDate ? 'ACTIVE' : 'LEAD'

  const property = await db.property.create({
    data: { tenantId: tenant.id, apn, address, jurisdictionId },
  })

  const deal = await db.deal.create({
    data: {
      tenantId: tenant.id,
      propertyId: property.id,
      strategyType: 'MULTIFAMILY',
      status: dealStatus,
      purchasePrice,
      purchaseDate,
      notes,
      multifamily: {
        create: {
          unitCount,
          averageMonthlyRent,
          vacancyRate,
          operatingExpenses: annualOpex != null ? { total: annualOpex } : undefined,
          annualDebtService: derived?.annualDebtService,
          grossScheduledIncome: derived?.grossScheduledIncome,
          netOperatingIncome: derived?.netOperatingIncome,
          capRate: derived?.capRate,
          dscr: derived?.dscr,
          loanAmount,
          interestRate,
          amortizationYears,
          loanMaturityDate,
        },
      },
    },
  })

  await generateMultifamilyEvents(deal.id)
  await applyTenantWorkflowRules(tenant.id, deal.id)
  await emitAuditEvent(tenant.id, 'DEAL_CREATED', { dealId: deal.id, strategy: 'MULTIFAMILY' }, userId)
  redirect(`/dashboard/deals/${deal.id}`)
}

export async function updateMultifamily(
  dealId: string,
  _prev: MultifamilyFormState,
  formData: FormData,
): Promise<MultifamilyFormState> {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return { error: 'Not authenticated' }
  const synced = await syncUserToDatabase()
  if (!synced) return { error: 'Tenant not found' }
  const { tenant } = synced

  const deal = await db.deal.findUnique({ where: { id: dealId, tenantId: tenant.id } })
  if (!deal) return { error: 'Deal not found' }

  const purchasePrice     = parseDec(fd(formData, 'purchasePrice'))
  const purchaseDate      = parseDate(fd(formData, 'purchaseDate'))
  const unitCount         = parseInt2(fd(formData, 'unitCount'))
  const averageMonthlyRent = parseDec(fd(formData, 'averageMonthlyRent'))
  const vacancyRatePct    = parseDec(fd(formData, 'vacancyRate'))
  const vacancyRate       = vacancyRatePct != null ? vacancyRatePct / 100 : null
  const annualOpex        = parseDec(fd(formData, 'annualOpex'))
  const occupiedUnits     = parseInt2(fd(formData, 'occupiedUnits'))
  const loanAmount        = parseDec(fd(formData, 'loanAmount'))
  const interestRatePct   = parseDec(fd(formData, 'interestRate'))
  const interestRate      = interestRatePct != null ? interestRatePct / 100 : null
  const amortizationYears = parseInt2(fd(formData, 'amortizationYears'))
  const loanMaturityDate  = parseDate(fd(formData, 'loanMaturityDate'))
  const propertyManagerName  = fd(formData, 'propertyManagerName')
  const propertyManagerPhone = fd(formData, 'propertyManagerPhone')
  const propertyManagerEmail = fd(formData, 'propertyManagerEmail')
  const notes             = fd(formData, 'notes')

  const derived = computeDerivedFields({
    unitCount, averageMonthlyRent, vacancyRate, annualOpex,
    purchasePrice, loanAmount, interestRate, amortizationYears,
  })

  await db.$transaction(async tx => {
    await tx.deal.update({
      where: { id: dealId },
      data: { purchasePrice, purchaseDate, notes },
    })
    await tx.dealMultifamily.upsert({
      where: { dealId },
      create: {
        dealId,
        unitCount,
        occupiedUnits,
        averageMonthlyRent,
        vacancyRate,
        operatingExpenses: annualOpex != null ? { total: annualOpex } : undefined,
        grossScheduledIncome: derived?.grossScheduledIncome,
        netOperatingIncome: derived?.netOperatingIncome,
        capRate: derived?.capRate,
        annualDebtService: derived?.annualDebtService,
        dscr: derived?.dscr,
        loanAmount,
        interestRate,
        amortizationYears,
        loanMaturityDate,
        propertyManagerName,
        propertyManagerPhone,
        propertyManagerEmail,
      },
      update: {
        unitCount,
        occupiedUnits,
        averageMonthlyRent,
        vacancyRate,
        operatingExpenses: annualOpex != null ? { total: annualOpex } : undefined,
        grossScheduledIncome: derived?.grossScheduledIncome,
        netOperatingIncome: derived?.netOperatingIncome,
        capRate: derived?.capRate,
        annualDebtService: derived?.annualDebtService,
        dscr: derived?.dscr,
        loanAmount,
        interestRate,
        amortizationYears,
        loanMaturityDate,
        propertyManagerName,
        propertyManagerPhone,
        propertyManagerEmail,
      },
    })
  })

  await generateMultifamilyEvents(dealId)
  revalidatePath(`/dashboard/deals/${dealId}`)
  redirect(`/dashboard/deals/${dealId}`)
}
