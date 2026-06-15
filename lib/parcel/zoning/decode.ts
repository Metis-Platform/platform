import { Prisma, StrategyType } from '@/app/generated/prisma'
import { db } from '@/lib/db'
import type { ProfileField } from '@/lib/jurisdiction-profile'

export interface ZoningDecoded {
  zoneCode: string
  description: string
  minLotSizeSqFt?: number
  maxDensityUnitsPerAcre?: number
  setbacks?: { front?: number; side?: number; rear?: number; rear_adjacent?: number }
  maxHeightFt?: number
  allowedUses?: string[]
  strAllowed?: boolean
  specialConditions?: string[]
  sourceUrl?: string
  extractedAt?: Date
}

type ZoningCodesData = {
  zoning_codes?: Record<string, unknown>
}

type ZoningDecodedJson = Omit<ZoningDecoded, 'extractedAt'> & {
  extractedAt?: string
}

export async function decodeZoning(fipsCounty: string, zoneCode: string): Promise<ZoningDecoded | null> {
  const jurisdiction = await db.jurisdiction.findUnique({
    where: { fips: fipsCounty },
    select: {
      id: true,
      profile: { select: { zoning: true } },
      strategyData: {
        where: { strategy: StrategyType.LAND },
        select: { data: true },
      },
    },
  })
  if (!jurisdiction) return null

  const existing = readDecoded(jurisdiction.strategyData[0]?.data, zoneCode)
  if (existing) return existing

  const inferred = inferDecodedFromProfile(zoneCode, jurisdiction.profile?.zoning)
  if (!inferred) return null

  const current = dataRecord(jurisdiction.strategyData[0]?.data)
  const zoningCodes = objectRecord(current.zoning_codes)
  const nextData: ZoningCodesData = {
    ...current,
    zoning_codes: {
      ...zoningCodes,
      [zoneCode]: toJsonDecoded(inferred),
    },
  }

  await db.jurisdictionStrategyData.upsert({
    where: { jurisdictionId_strategy: { jurisdictionId: jurisdiction.id, strategy: StrategyType.LAND } },
    update: { data: nextData as Prisma.InputJsonValue },
    create: {
      jurisdictionId: jurisdiction.id,
      strategy: StrategyType.LAND,
      data: nextData as Prisma.InputJsonValue,
    },
  })

  return inferred
}

function readDecoded(data: unknown, zoneCode: string): ZoningDecoded | null {
  const decoded = objectRecord(objectRecord(dataRecord(data).zoning_codes)[zoneCode])
  if (typeof decoded.zoneCode !== 'string' || typeof decoded.description !== 'string') return null

  return {
    ...decoded,
    zoneCode: decoded.zoneCode,
    description: decoded.description,
    minLotSizeSqFt: optionalNumber(decoded.minLotSizeSqFt),
    maxDensityUnitsPerAcre: optionalNumber(decoded.maxDensityUnitsPerAcre),
    maxHeightFt: optionalNumber(decoded.maxHeightFt),
    allowedUses: stringArray(decoded.allowedUses),
    strAllowed: typeof decoded.strAllowed === 'boolean' ? decoded.strAllowed : undefined,
    specialConditions: stringArray(decoded.specialConditions),
    sourceUrl: typeof decoded.sourceUrl === 'string' ? decoded.sourceUrl : undefined,
    extractedAt: typeof decoded.extractedAt === 'string' ? new Date(decoded.extractedAt) : undefined,
  }
}

function inferDecodedFromProfile(zoneCode: string, zoningProfile: unknown): ZoningDecoded | null {
  const profile = objectRecord(zoningProfile)
  const commonZoning = fieldValue(profile.commonZoning)
  const zoningPortalUrl = fieldValue(profile.zoningPortalUrl)
  const minLotSize = optionalNumber(fieldValue(profile.minimumLotSizeSqft))
  const strRules = fieldValue(profile.shortTermRentalAllowed ?? profile.strZoningRules)

  return {
    zoneCode,
    description: typeof commonZoning === 'string' && commonZoning.trim().length > 0
      ? `${zoneCode}: ${commonZoning}`
      : `${zoneCode} zoning code. Verify ordinance details before relying on dimensional standards.`,
    minLotSizeSqFt: minLotSize,
    strAllowed: typeof strRules === 'boolean' ? strRules : undefined,
    sourceUrl: typeof zoningPortalUrl === 'string' ? zoningPortalUrl : undefined,
    extractedAt: new Date(),
  }
}

function dataRecord(data: unknown): Record<string, unknown> {
  return objectRecord(data)
}

function objectRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function fieldValue(value: unknown): ProfileField['value'] | undefined {
  const record = objectRecord(value)
  return record.value as ProfileField['value'] | undefined
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function stringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every(item => typeof item === 'string') ? value : undefined
}

function toJsonDecoded(decoded: ZoningDecoded): ZoningDecodedJson {
  return {
    ...decoded,
    extractedAt: decoded.extractedAt?.toISOString(),
  }
}
