import type { JurisdictionStrategyData } from '@/app/generated/prisma'
import type { JurisdictionFacts } from './types'

interface JurisdictionStrategyJson {
  taxLienInterestRate?: number
  taxLienRedemptionPeriodDays?: number
  taxDeedRedemptionDays?: number
  strAllowed?: boolean
  rentControlZone?: boolean
  wholesaleLicenseRequired?: boolean
  minLotSizeByZone?: Record<string, number>
  setbacksByZone?: Record<string, { front?: number; side?: number; rear?: number }>
  allowedUsesByZone?: Record<string, string[]>
  subdivisionAllowed?: boolean
  quietTitleRequirements?: string[]
  deedQualityPostTaxSale?: 'warranty' | 'special_warranty' | 'quit_claim'
  zoning_codes?: Record<string, {
    minLotSizeSqFt?: number
    minLotWidthFt?: number
    setbacks?: { front?: number; side?: number; rear?: number }
    allowedUses?: string[]
    strAllowed?: boolean
  }>
}

export function buildJurisdictionFacts(
  strategyData: JurisdictionStrategyData | null,
  fmrByBedroom: Record<number, number>,
  options: { allowCountyLandUseRules?: boolean } = {},
): JurisdictionFacts {
  const data = asJurisdictionStrategyJson(strategyData?.data)
  const allowCountyLandUseRules = options.allowCountyLandUseRules ?? true

  return {
    minLotSizeSqFt(zoning?: string): number | undefined {
      if (!allowCountyLandUseRules) return undefined
      const decoded = zoning ? data.zoning_codes?.[zoning] : undefined
      if (decoded?.minLotSizeSqFt != null) return decoded.minLotSizeSqFt
      if (!data.minLotSizeByZone) return undefined
      if (!zoning) return data.minLotSizeByZone.default
      return data.minLotSizeByZone[zoning] ?? data.minLotSizeByZone.default
    },

    minLotWidthFt(zoning?: string): number | undefined {
      if (!allowCountyLandUseRules) return undefined
      if (!zoning) return undefined
      return data.zoning_codes?.[zoning]?.minLotWidthFt
    },

    setbackFeet(zoning?: string): { front?: number; side?: number; rear?: number } | undefined {
      if (!allowCountyLandUseRules) return undefined
      if (!zoning) return undefined
      return data.zoning_codes?.[zoning]?.setbacks ?? data.setbacksByZone?.[zoning]
    },

    allowedUses(zoning?: string): string[] | undefined {
      if (!allowCountyLandUseRules) return undefined
      if (!zoning) return undefined
      return data.zoning_codes?.[zoning]?.allowedUses ?? data.allowedUsesByZone?.[zoning]
    },

    strAllowed: allowCountyLandUseRules ? data.strAllowed : undefined,
    rentControlZone: allowCountyLandUseRules ? data.rentControlZone : undefined,
    wholesaleLicenseRequired: allowCountyLandUseRules ? data.wholesaleLicenseRequired : undefined,
    taxDeedRedemptionDays: data.taxDeedRedemptionDays,
    taxLienInterestRate: data.taxLienInterestRate,
    taxLienRedemptionPeriodDays: data.taxLienRedemptionPeriodDays,
    subdivisionAllowed: allowCountyLandUseRules ? data.subdivisionAllowed : undefined,
    quietTitleRequirements: data.quietTitleRequirements,
    deedQualityPostTaxSale: data.deedQualityPostTaxSale,

    fmr(bedrooms: number): number | undefined {
      return fmrByBedroom[bedrooms]
    },
  }
}

function asJurisdictionStrategyJson(value: unknown): JurisdictionStrategyJson {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as JurisdictionStrategyJson
}
