import type { ExitKey } from './keys'

export type StrategyType =
  | 'TAX_LIEN'
  | 'TAX_DEED'
  | 'FORECLOSURE'
  | 'FIX_FLIP'
  | 'WHOLESALE'
  | 'BUY_HOLD'
  | 'LAND'
  | 'MULTIFAMILY'

export type Verdict = 'VIABLE' | 'NOT_VIABLE' | 'CONDITIONAL' | 'INSUFFICIENT_DATA'

export type ParcelSourceProvider = 'fl_dor' | 'regrid' | 'manual' | 'ai_extracted' | 'unknown'

export interface ParcelFieldSource {
  provider: ParcelSourceProvider
  observedAt: Date
  ttlDays?: number
}

export interface DataGap {
  field: string
  severity: 'HARD' | 'SOFT'
  message: string
}

export interface ParcelProfile {
  apn?: string
  state?: string
  county?: string
  zoning?: string
  lotSizeSqFt?: number
  improved?: boolean
  structureSqFt?: number
  bedroomCount?: number
  propertyClass?: 'A' | 'B' | 'C'
  purchasePrice?: number
  assessedValue?: number
  arv?: { low: number; mid: number; high: number }
  rehabCost?: { low: number; mid: number; high: number }
  comparableRent?: number
  noi?: { low: number; mid: number; high: number }
  lienFaceValue?: number
  sources?: Partial<Record<string, ParcelFieldSource>>
}

export interface InvestorConstraints {
  maxPurchasePrice?: number
  improvementCapital?: number
  holdMonthsTolerance?: number
  targetRoi?: number
  financing: 'CASH' | 'LENDER'
  licenseTypes?: string[]
}

export interface JurisdictionFacts {
  minLotSizeSqFt(zoning?: string): number | undefined
  setbackFeet(zoning?: string): { front?: number; side?: number; rear?: number } | undefined
  strAllowed?: boolean
  rentControlZone?: boolean
  wholesaleLicenseRequired?: boolean
  taxDeedRedemptionDays?: number
  taxLienInterestRate?: number
  fmr(bedrooms: number): number | undefined
}

export interface Projection {
  low: number
  mid: number
  high: number
  basis: string
  assumptions: string[]
  currency: 'USD'
  metric: 'roi' | 'net_profit' | 'monthly_cashflow' | 'irr'
}

export interface ExitResult {
  exitKey: ExitKey
  verdict: Verdict
  confidence: number
  blockers: string[]
  conditions: string[]
  dataGaps: DataGap[]
  projection?: Projection
}

export interface EvalContext {
  parcel: ParcelProfile
  jurisdiction: JurisdictionFacts
  investor: InvestorConstraints
  strategy: StrategyType
}

export interface ExitEvaluator {
  exitKey: ExitKey
  evaluate(ctx: EvalContext): Omit<ExitResult, 'confidence' | 'dataGaps'>
}
