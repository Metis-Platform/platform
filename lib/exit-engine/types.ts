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

export type ParcelSourceProvider =
  | 'fl_dor'
  | 'regrid'
  | 'fema_nfhl'
  | 'epa_echo'
  | 'manual'
  | 'ai_extracted'
  | 'unknown'
  | (string & {})

export interface DataSource {
  provider: ParcelSourceProvider
  retrievedAt: Date
  ttlHours: number
  observedAt?: Date
  ttlDays?: number
}

export type ParcelFieldSource = DataSource

export interface DataGap {
  field: string
  severity?: 'HARD' | 'SOFT'
  message?: string
  label?: string
  reason?: 'missing_hard' | 'missing_soft' | 'stale'
  deepLink?: string
  impact?: string
}

export interface Comp {
  apn?: string
  address?: string
  saleDate: Date
  salePrice: number
  sqFt?: number
  acreage?: number
  distanceMiles?: number
  adjustedPrice?: number
}

export interface ParcelProfile {
  apn: string
  apnRaw: string
  fipsCounty: string
  lotSizeSqFt?: number
  lotSizeAcres?: number
  netDevelopableAcres?: number
  frontageLinearFt?: number
  shape?: 'regular' | 'irregular' | 'flag' | 'pipestem'
  topography?: 'flat' | 'sloped' | 'hilly' | 'wetland'
  improved?: boolean
  conditionScore?: number
  landUseCode?: string
  zoning?: string
  zoningDescription?: string
  floodZone?: string
  floodPanel?: string
  wetlandsPresent?: boolean
  wetlandsAcres?: number
  brownfieldFlag?: boolean
  undergroundTankFlag?: boolean
  slopePercent?: number
  titleType?: 'warranty' | 'tax_deed' | 'quit_claim' | 'special_warranty'
  deedQuality?: 'insurable' | 'conditional' | 'uninsurable'
  quietTitleRequired?: boolean
  irsLienPresent?: boolean
  bankruptcyStay?: boolean
  survivingLiens?: string[]
  hoa?: { present: boolean; monthlyFee?: number; transferFee?: number }
  waterAvailable?: boolean
  sewerAvailable?: boolean
  electricAvailable?: boolean
  gasAvailable?: boolean
  utilitiesNotes?: string
  roadFrontage?: 'paved' | 'unpaved' | 'easement_only' | 'landlocked'
  roadFrontageFt?: number
  assessedValue?: number
  assessedYear?: number
  marketValueEstimate?: number
  comps?: Comp[]
  estimatedArv?: number
  dataCompleteness: number
  lastUpdated: Date
  sources: Partial<Record<string, ParcelFieldSource>>
  state?: string
  county?: string
  structureSqFt?: number
  bedroomCount?: number
  propertyClass?: 'A' | 'B' | 'C'
  purchasePrice?: number
  arv?: { low: number; mid: number; high: number }
  rehabCost?: { low: number; mid: number; high: number }
  comparableRent?: number
  noi?: { low: number; mid: number; high: number }
  lienFaceValue?: number
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
