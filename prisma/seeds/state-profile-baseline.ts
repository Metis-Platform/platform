import { getStateInfo, type InvestmentCategory } from '../../lib/state-info'

export type BaselineField<T> = {
  value: T
  confidence: number
  verifiedById: 'system'
  volatility: 'static'
  citation: {
    label: string
    url: string | null
  }
}

export type StateProfileBaseline = {
  taxSale: Record<string, BaselineField<string | number | null>>
  foreclosure: Record<string, BaselineField<string>>
  landlordTenant: Record<string, BaselineField<string | boolean>>
  wholesale: Record<string, BaselineField<string>>
}

const STATE_CODES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
] as const

export type StateCode = (typeof STATE_CODES)[number]

const SALE_TYPE_BY_CATEGORY: Record<InvestmentCategory, string> = {
  TAX_LIEN: 'lien',
  TAX_DEED: 'deed',
  REDEEMABLE_DEED: 'redeemable_deed',
  HYBRID: 'lien',
  NOT_ACTIVE: 'not_active',
}

const JUDICIAL_FORECLOSURE_STATES = new Set<StateCode>([
  'CT','DE','FL','IL','IN','KS','KY','LA','ME','NJ','NM','NY','ND','OH','PA','SC','VT','WI',
])
const NON_JUDICIAL_FORECLOSURE_STATES = new Set<StateCode>([
  'AL','AK','AZ','AR','CA','CO','GA','HI','ID','IA','MA','MD','MI','MN','MS','MO','MT','NE','NV','NH','NC','OK','OR','RI','SD','TN','TX','UT','VA','WA','WV','WY',
])

const RENT_CONTROL_STATUS: Partial<Record<StateCode, string>> = {
  CA: 'statewide_cap_and_local_allowed',
  OR: 'statewide_cap',
  NY: 'local_programs_enabled',
  NJ: 'local_programs_enabled',
  MD: 'local_programs_enabled',
  ME: 'local_programs_enabled',
}

const JUST_CAUSE_STATUS: Partial<Record<StateCode, boolean>> = {
  CA: true,
  NJ: true,
  OR: true,
  NY: true,
  WA: true,
}

const WHOLESALE_RESTRICTIONS: Partial<Record<StateCode, string>> = {
  IL: 'allowed_with_wholesale_disclosure_required',
  OK: 'allowed_with_predatory_real_estate_service_provider_restrictions',
  OR: 'allowed_with_represented_interest_marketing_limits',
}

function bidFormat(raw: string | null): string | null {
  const value = raw?.toLowerCase() ?? ''
  if (!value) return null
  if (value.includes('bid down interest')) return 'bid_down_interest'
  if (value.includes('bid down ownership')) return 'bid_down_ownership'
  if (value.includes('rotational')) return 'rotational'
  if (value.includes('random')) return 'random'
  if (value.includes('premium')) return 'premium_bid'
  if (value.includes('sealed')) return 'sealed_bid'
  return 'varies'
}

function redemptionPeriodMonths(raw: string | null): number | null {
  if (!raw) return null
  const lower = raw.toLowerCase()
  const yearMatch = lower.match(/(\d+(?:\.\d+)?)\s*years?/)
  if (yearMatch) return Math.round(Number(yearMatch[1]) * 12)
  const monthMatch = lower.match(/(\d+)\s*months?/)
  if (monthMatch) return Number(monthMatch[1])
  const dayMatch = lower.match(/(\d+)\s*days?/)
  if (dayMatch) return Math.round(Number(dayMatch[1]) / 30)
  return null
}

function foreclosureMode(state: StateCode): string {
  if (JUDICIAL_FORECLOSURE_STATES.has(state)) return 'judicial'
  if (NON_JUDICIAL_FORECLOSURE_STATES.has(state)) return 'non_judicial'
  return 'mixed'
}

function field<T>(state: StateCode, value: T): BaselineField<T> {
  const info = getStateInfo(state)
  return {
    value,
    confidence: 1,
    verifiedById: 'system',
    volatility: 'static',
    citation: {
      label: `${info?.stateName ?? state} state statutory baseline`,
      url: info?.stateStatutes ?? info?.stateWebsite ?? null,
    },
  }
}

export function buildStateProfileBaseline(state: string): StateProfileBaseline {
  const code = state.toUpperCase() as StateCode
  if (!STATE_CODES.includes(code)) {
    throw new Error(`Unsupported state code: ${state}`)
  }

  const info = getStateInfo(code)
  if (!info) {
    throw new Error(`Missing state info for: ${state}`)
  }

  return {
    taxSale: {
      saleType: field(code, SALE_TYPE_BY_CATEGORY[info.investmentType]),
      bidFormat: field(code, bidFormat(info.bidMethod)),
      redemptionPeriodMonths: field(code, redemptionPeriodMonths(info.redemptionPeriod)),
      interestRateSchedule: field(code, info.interestRate),
      saleSchedule: field(code, info.saleDates),
      overTheCounterAvailable: field(code, info.overTheCounter ? 'yes' : 'no'),
      secondarySaleType: field(code, info.investmentType === 'HYBRID' ? 'deed' : null),
    },
    foreclosure: {
      judicialOrNonJudicial: field(code, foreclosureMode(code)),
      lienSurvivalHierarchy: field(code, 'property_tax_and_municipal_liens_superior; mortgage/junior liens generally extinguished or foreclosed per state process; IRS/environmental/HOA/special-assessment exceptions require title review'),
    },
    landlordTenant: {
      rentControlStatus: field(code, RENT_CONTROL_STATUS[code] ?? 'no_statewide_rent_control; local preemption/ordinance review required'),
      justCauseEvictionRequired: field(code, JUST_CAUSE_STATUS[code] ?? false),
    },
    wholesale: {
      assignmentContractLegality: field(code, WHOLESALE_RESTRICTIONS[code] ?? 'generally_allowed_if_assigning_equitable_interest; brokerage, advertising, and disclosure rules require transaction review'),
    },
  }
}
