import { projectCapRate, projectLienReturn, projectMonthlyRent, projectNetProfit } from '../projections'
import type { ExitKey } from '../keys'
import type { BuildableEnvelope, EvalContext, ExitResult, Projection, Verdict } from '../types'

export type BaseExitResult = Omit<ExitResult, 'confidence' | 'dataGaps'>

export function checkUniversalBlockers(ctx: EvalContext): string[] {
  const blockers: string[] = []
  if (ctx.parcel.bankruptcyStay) {
    blockers.push('Bankruptcy automatic stay - contact bankruptcy attorney before any transaction')
  }
  return blockers
}

export function blockedByUniversal(exitKey: ExitKey, ctx: EvalContext): BaseExitResult | null {
  const blockers = checkUniversalBlockers(ctx)
  return blockers.length > 0 ? result(exitKey, 'NOT_VIABLE', blockers) : null
}

export function missingData(exitKey: ExitKey, ctx: EvalContext, fields: string[]): BaseExitResult | null {
  const missing = fields.filter(field => !hasValue(ctx, field))
  return missing.length > 0
    ? result(exitKey, 'INSUFFICIENT_DATA', [], [`Missing required data: ${missing.join(', ')}`])
    : null
}

export function result(
  exitKey: ExitKey,
  verdict: Verdict,
  blockers: string[] = [],
  conditions: string[] = [],
  projection?: Projection,
  buildableEnvelope?: BuildableEnvelope,
): BaseExitResult {
  return {
    exitKey,
    verdict,
    blockers,
    conditions,
    ...(projection ? { projection } : {}),
    ...(buildableEnvelope ? { buildableEnvelope } : {}),
  }
}

export function range(mid: number, spread = 0.15): { low: number; mid: number; high: number } {
  return { low: mid * (1 - spread), mid, high: mid * (1 + spread) }
}

export function arvRange(ctx: EvalContext) {
  return ctx.parcel.arv ?? (ctx.parcel.estimatedArv == null ? undefined : range(ctx.parcel.estimatedArv))
}

export function rehabRange(ctx: EvalContext, fallbackMid = 35000) {
  return ctx.parcel.rehabCost ?? range(fallbackMid, 0.25)
}

export function purchasePrice(ctx: EvalContext): number {
  return ctx.parcel.purchasePrice ?? 0
}

export function minLotSize(ctx: EvalContext): number | undefined {
  return ctx.jurisdiction.minLotSizeSqFt(ctx.parcel.zoning)
}

export function buildableEnvelope(ctx: EvalContext): BuildableEnvelope | undefined {
  const frontage = ctx.parcel.frontageLinearFt
  const depth = ctx.parcel.lotDepthFt
  const setbacks = ctx.jurisdiction.setbackFeet(ctx.parcel.zoning)
  if (frontage == null || depth == null || setbacks?.front == null || setbacks.side == null || setbacks.rear == null) return undefined

  const widthFt = Math.max(0, frontage - setbacks.side * 2)
  const depthFt = Math.max(0, depth - setbacks.front - setbacks.rear)
  return {
    widthFt,
    depthFt,
    areaSqFt: widthFt * depthFt,
    setbacks: { front: setbacks.front, side: setbacks.side, rear: setbacks.rear },
  }
}

export function isFloodBuildRisk(ctx: EvalContext): boolean {
  return ['AE', 'VE'].includes(ctx.parcel.floodZone ?? '') && ctx.parcel.wetlandsPresent === true
}

export function hasWholesaleLicense(ctx: EvalContext): boolean {
  return ctx.investor.licenseTypes?.includes('RE_LICENSE') ?? false
}

export function lienProjection(ctx: EvalContext, holdMonths = 24): Projection | undefined {
  if (ctx.parcel.lienFaceValue == null || ctx.jurisdiction.taxLienInterestRate == null) return undefined
  return projectLienReturn({
    faceValue: ctx.parcel.lienFaceValue,
    interestRate: ctx.jurisdiction.taxLienInterestRate,
    holdMonths,
    redemptionProbability: 0.8,
  })
}

export function flipProjection(ctx: EvalContext): Projection | undefined {
  const arv = arvRange(ctx)
  if (!arv) return undefined
  return projectNetProfit({
    arv,
    purchasePrice: purchasePrice(ctx),
    rehabCost: rehabRange(ctx),
    holdingCostPerMonth: 1000,
    holdMonths: 6,
  })
}

export function rentProjection(ctx: EvalContext): Projection | undefined {
  const rent = ctx.parcel.comparableRent ?? ctx.jurisdiction.fmr(ctx.parcel.bedroomCount ?? 2)
  if (rent == null) return undefined
  return projectMonthlyRent({
    fmr: rent,
    comparableRent: ctx.parcel.comparableRent,
    bedroomCount: ctx.parcel.bedroomCount,
    propertyClass: ctx.parcel.propertyClass,
  })
}

export function capRateProjection(ctx: EvalContext, noiMid?: number): Projection | undefined {
  const noiRange = ctx.parcel.noi ?? (noiMid == null ? undefined : range(noiMid))
  if (!noiRange) return undefined
  return projectCapRate({
    noi: {
      ...noiRange,
      basis: 'NOI estimate',
      assumptions: ['Operating income and expense estimate'],
      currency: 'USD',
      metric: 'net_profit',
    },
    purchasePrice: Math.max(purchasePrice(ctx), 1),
  })
}

function hasValue(ctx: EvalContext, field: string): boolean {
  const value = field.split('.').reduce<unknown>((current, segment) => {
    if (current == null || typeof current !== 'object') return undefined
    return (current as Record<string, unknown>)[segment]
  }, field.startsWith('jurisdiction.') ? ctx : ctx.parcel)

  return value !== undefined && value !== null && value !== ''
}
