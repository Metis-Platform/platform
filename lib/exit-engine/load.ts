import type { Prisma, StrategyType as DbStrategyType } from '@/app/generated/prisma'
import { db } from '@/lib/db'
import { normalizeApn } from '@/lib/parcel/apn'
import { assembleParcelProfile } from '@/lib/parcel/profile'
import { buildJurisdictionFacts } from './jurisdiction-facts'
import type { EvalContext, InvestorConstraints, ParcelProfile, StrategyType } from './types'

type DealForEval = Prisma.DealGetPayload<{
  include: {
    property: {
      include: {
        jurisdiction: {
          include: {
            strategyData: true
          }
        }
      }
    }
    taxLien: true
    taxDeed: true
    foreclosure: true
    fixFlip: true
    land: true
    wholesale: true
    buyHold: true
    multifamily: true
  }
}>

export async function buildEvalContext(
  dealId: string,
  tenantId: string,
  investor: InvestorConstraints,
): Promise<EvalContext> {
  const deal = await db.deal.findFirstOrThrow({
    where: { id: dealId, tenantId },
    include: {
      property: {
        include: {
          jurisdiction: {
            include: {
              strategyData: true,
            },
          },
        },
      },
      taxLien: true,
      taxDeed: true,
      foreclosure: true,
      fixFlip: true,
      land: true,
      wholesale: true,
      buyHold: true,
      multifamily: true,
    },
  })

  const property = deal.property
  const jurisdiction = property.jurisdiction
  const fipsCounty = jurisdiction.fips ?? ''
  const apnNormalized = normalizeApn(property.apn, fipsCounty).normalized

  const cacheRows = fipsCounty
    ? await db.parcelDataCache.findMany({
        where: {
          tenantId,
          apnNormalized,
          fipsCounty,
          expiresAt: { gt: new Date() },
        },
      })
    : []

  const parcel = applyDealExtensionFacts(assembleParcelProfile(deal, cacheRows), deal)
  const fmrRates = await db.fmrRate.findMany({
    where: {
      state: jurisdiction.state,
      county: jurisdiction.county,
    },
    orderBy: { year: 'desc' },
  })

  const strategyData = jurisdiction.strategyData.find(row => row.strategy === deal.strategyType) ?? null

  return {
    parcel,
    jurisdiction: buildJurisdictionFacts(strategyData, fmrByBedroom(fmrRates)),
    investor,
    strategy: toEngineStrategy(deal.strategyType),
  }
}

function applyDealExtensionFacts(parcel: ParcelProfile, deal: DealForEval): ParcelProfile {
  const fixed = deal.fixFlip
  const buyHold = deal.buyHold
  const multifamily = deal.multifamily
  const wholesale = deal.wholesale

  return {
    ...parcel,
    lienFaceValue: decimalToNumber(deal.taxLien?.faceAmount) ?? parcel.lienFaceValue,
    arv: fixed?.arv == null ? parcel.arv : rangeFromMid(decimalToNumber(fixed.arv)),
    rehabCost: fixed?.rehabBudget == null ? parcel.rehabCost : rangeFromMid(decimalToNumber(fixed.rehabBudget)),
    comparableRent: decimalToNumber(buyHold?.actualMonthlyRent)
      ?? decimalToNumber(buyHold?.targetMonthlyRent)
      ?? parcel.comparableRent,
    bedroomCount: buyHold?.fmrBedrooms ?? parcel.bedroomCount,
    noi: multifamily?.netOperatingIncome == null ? parcel.noi : rangeFromMid(decimalToNumber(multifamily.netOperatingIncome)),
    purchasePrice: decimalToNumber(deal.purchasePrice)
      ?? decimalToNumber(wholesale?.contractPrice)
      ?? parcel.purchasePrice,
  }
}

function fmrByBedroom(rates: Array<{ bedrooms: number; amount: { toString(): string } | number }>): Record<number, number> {
  const byBedroom: Record<number, number> = {}
  for (const rate of rates) {
    if (byBedroom[rate.bedrooms] != null) continue
    const amount = decimalToNumber(rate.amount)
    if (amount != null) byBedroom[rate.bedrooms] = amount
  }
  return byBedroom
}

function rangeFromMid(mid: number | undefined): { low: number; mid: number; high: number } | undefined {
  if (mid == null) return undefined
  return {
    low: mid * 0.9,
    mid,
    high: mid * 1.1,
  }
}

function decimalToNumber(value: { toString(): string } | number | null | undefined): number | undefined {
  if (value == null) return undefined
  const numberValue = typeof value === 'number' ? value : Number(value.toString())
  return Number.isFinite(numberValue) ? numberValue : undefined
}

function toEngineStrategy(strategy: DbStrategyType): StrategyType {
  return strategy
}
