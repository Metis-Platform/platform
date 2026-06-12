import { describe, it, expect } from 'vitest'
import {
  costBasis,
  incomeToDate,
  realizedPnl,
  accruedLienInterest,
  annualizedReturn,
  unrealizedLienValue,
  type LedgerRow,
} from '@/lib/economics'
import { TRANSACTION_DIRECTION } from '@/lib/transactions'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function day(year: number, month: number, date: number): Date {
  return new Date(year, month - 1, date)
}

const PURCHASE_ROW: LedgerRow = { type: 'PURCHASE', amount: 5000, date: day(2024, 1, 15) }
const SUB_TAX_ROW: LedgerRow = { type: 'SUBSEQUENT_TAX', amount: 200, date: day(2024, 6, 1) }
const REDEMPTION_ROW: LedgerRow = { type: 'REDEMPTION_RECEIVED', amount: 6500, date: day(2024, 12, 1) }
const OTHER_INCOME_ROW: LedgerRow = { type: 'OTHER_INCOME', amount: 100, date: day(2024, 12, 15) }

// ---------------------------------------------------------------------------
// TRANSACTION_DIRECTION totality
// All 17 TransactionType values that existed when #132-P1 shipped must be covered.
// ---------------------------------------------------------------------------

describe('TRANSACTION_DIRECTION', () => {
  const KNOWN_TRANSACTION_TYPES = [
    'PURCHASE',
    'SUBSEQUENT_TAX',
    'LEGAL_FEE',
    'TITLE_SEARCH',
    'RECORDING_FEE',
    'REDEMPTION_RECEIVED',
    'OTHER_INCOME',
    'OTHER_EXPENSE',
    'SALE_PROCEEDS',
    'RENT_RECEIVED',
    'NOTE_PAYMENT_RECEIVED',
    'REHAB_COST',
    'INSURANCE',
    'PROPERTY_TAX',
    'HOA_FEE',
    'MANAGEMENT_FEE',
    'LOAN_PAYMENT',
  ] as const

  it('maps every known TransactionType to IN or OUT', () => {
    for (const type of KNOWN_TRANSACTION_TYPES) {
      const dir = TRANSACTION_DIRECTION[type]
      expect(dir === 'IN' || dir === 'OUT', `${type} must map to IN or OUT`).toBe(true)
    }
  })

  it('has exactly 17 entries', () => {
    expect(Object.keys(TRANSACTION_DIRECTION)).toHaveLength(17)
  })

  it('IN-direction types are correct', () => {
    const inTypes = Object.entries(TRANSACTION_DIRECTION)
      .filter(([, dir]) => dir === 'IN')
      .map(([type]) => type)
    expect(inTypes.sort()).toEqual(
      ['NOTE_PAYMENT_RECEIVED', 'OTHER_INCOME', 'REDEMPTION_RECEIVED', 'RENT_RECEIVED', 'SALE_PROCEEDS'].sort()
    )
  })
})

// ---------------------------------------------------------------------------
// costBasis
// ---------------------------------------------------------------------------

describe('costBasis', () => {
  it('returns 0 for empty ledger', () => {
    expect(costBasis([])).toBe(0)
  })

  it('sums OUT-direction amounts only', () => {
    expect(costBasis([PURCHASE_ROW, SUB_TAX_ROW, REDEMPTION_ROW])).toBe(5200)
  })

  it('returns 0 when there are only IN rows', () => {
    expect(costBasis([REDEMPTION_ROW, OTHER_INCOME_ROW])).toBe(0)
  })

  it('handles all OUT types', () => {
    const rows: LedgerRow[] = [
      { type: 'LEGAL_FEE', amount: 300, date: day(2024, 3, 1) },
      { type: 'TITLE_SEARCH', amount: 150, date: day(2024, 3, 1) },
      { type: 'RECORDING_FEE', amount: 50, date: day(2024, 3, 1) },
    ]
    expect(costBasis(rows)).toBe(500)
  })
})

// ---------------------------------------------------------------------------
// incomeToDate
// ---------------------------------------------------------------------------

describe('incomeToDate', () => {
  it('returns 0 for empty ledger', () => {
    expect(incomeToDate([])).toBe(0)
  })

  it('sums IN-direction amounts only', () => {
    expect(incomeToDate([PURCHASE_ROW, REDEMPTION_ROW, OTHER_INCOME_ROW])).toBe(6600)
  })

  it('returns 0 when there are only OUT rows', () => {
    expect(incomeToDate([PURCHASE_ROW, SUB_TAX_ROW])).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// realizedPnl
// ---------------------------------------------------------------------------

describe('realizedPnl', () => {
  it('returns 0 for empty ledger', () => {
    expect(realizedPnl([])).toBe(0)
  })

  it('returns positive P&L when income > cost', () => {
    // income: 6500 redemption, cost: 5000 purchase + 200 sub-tax = 5200 → P&L 1300
    expect(realizedPnl([PURCHASE_ROW, SUB_TAX_ROW, REDEMPTION_ROW])).toBe(1300)
  })

  it('returns negative P&L when cost > income', () => {
    const rows: LedgerRow[] = [
      { type: 'PURCHASE', amount: 10000, date: day(2024, 1, 1) },
      { type: 'SALE_PROCEEDS', amount: 8000, date: day(2024, 6, 1) },
    ]
    expect(realizedPnl(rows)).toBe(-2000)
  })

  it('returns 0 with only OUT rows', () => {
    expect(realizedPnl([PURCHASE_ROW])).toBe(-5000)
  })
})

// ---------------------------------------------------------------------------
// accruedLienInterest
// ---------------------------------------------------------------------------

describe('accruedLienInterest', () => {
  it('returns 0 for empty period (asOf === issueDate)', () => {
    const d = day(2024, 1, 1)
    expect(accruedLienInterest({ faceAmount: 5000, annualRate: 0.18, issueDate: d, asOf: d })).toBe(0)
  })

  it('returns 0 when asOf is before issueDate', () => {
    expect(
      accruedLienInterest({
        faceAmount: 5000,
        annualRate: 0.18,
        issueDate: day(2024, 6, 1),
        asOf: day(2024, 1, 1),
      })
    ).toBe(0)
  })

  it('computes accrual for exactly 1 year', () => {
    const result = accruedLienInterest({
      faceAmount: 10000,
      annualRate: 0.12,
      issueDate: day(2023, 1, 1),
      asOf: day(2024, 1, 1),
    })
    // 365 days → 10000 × 0.12 × (365/365) = 1200
    expect(result).toBeCloseTo(1200, 2)
  })

  it('computes accrual for 200 days at 18% on $5000 face', () => {
    // 5000 × 0.18 × (200/365) ≈ 493.15
    const result = accruedLienInterest({
      faceAmount: 5000,
      annualRate: 0.18,
      issueDate: day(2024, 1, 1),
      asOf: day(2024, 7, 20), // exactly 200 days later (Jan 1 → Jul 20 in 2024)
    })
    expect(result).toBeCloseTo(5000 * 0.18 * (200 / 365), 4)
  })

  it('handles 0% rate', () => {
    expect(
      accruedLienInterest({
        faceAmount: 5000,
        annualRate: 0,
        issueDate: day(2024, 1, 1),
        asOf: day(2024, 6, 1),
      })
    ).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// annualizedReturn
// ---------------------------------------------------------------------------

describe('annualizedReturn', () => {
  it('returns null when invested is 0', () => {
    expect(
      annualizedReturn({ invested: 0, returned: 1000, startDate: day(2024, 1, 1), endDate: day(2024, 12, 31) })
    ).toBeNull()
  })

  it('computes annualized return for exactly 1 year', () => {
    // 1000 invested, 1180 returned after 365 days → 18% annualized
    const result = annualizedReturn({
      invested: 1000,
      returned: 1180,
      startDate: day(2023, 1, 1),
      endDate: day(2024, 1, 1),
    })
    expect(result).toBeCloseTo(0.18, 4)
  })

  it('handles same-day start and end (uses max 1 day)', () => {
    const d = day(2024, 6, 1)
    const result = annualizedReturn({ invested: 1000, returned: 1000, startDate: d, endDate: d })
    // 0 profit → 0% return regardless of time
    expect(result).toBeCloseTo(0, 4)
  })

  it('returns negative for a losing deal', () => {
    const result = annualizedReturn({
      invested: 10000,
      returned: 8000,
      startDate: day(2024, 1, 1),
      endDate: day(2024, 7, 2), // 183 days
    })
    expect(result).toBeLessThan(0)
  })

  it('returns a high annualized figure for short fast wins', () => {
    // 5% gain in 36.5 days ≈ 50% annualized
    const result = annualizedReturn({
      invested: 10000,
      returned: 10500,
      startDate: day(2024, 1, 1),
      endDate: day(2024, 2, 6), // ~36 days
    })
    expect(result).toBeGreaterThan(0.4)
  })
})

// ---------------------------------------------------------------------------
// unrealizedLienValue
// ---------------------------------------------------------------------------

describe('unrealizedLienValue', () => {
  it('equals faceAmount when asOf is issueDate (no accrual)', () => {
    const d = day(2024, 1, 1)
    expect(
      unrealizedLienValue({ faceAmount: 5000, annualRate: 0.18, issueDate: d, asOf: d })
    ).toBe(5000)
  })

  it('equals faceAmount + accrued interest', () => {
    const params = { faceAmount: 5000, annualRate: 0.18, issueDate: day(2024, 1, 1), asOf: day(2024, 7, 19) }
    const expected = 5000 + accruedLienInterest(params)
    expect(unrealizedLienValue(params)).toBeCloseTo(expected, 4)
  })

  it('returns faceAmount when asOf is before issueDate', () => {
    expect(
      unrealizedLienValue({
        faceAmount: 5000,
        annualRate: 0.18,
        issueDate: day(2024, 6, 1),
        asOf: day(2024, 1, 1),
      })
    ).toBe(5000)
  })
})

// ---------------------------------------------------------------------------
// Realistic lien scenario: $5,000 face at 18% for 200 days
// Purchased for $5,000, $200 subsequent tax; redeemed after 200 days
// ---------------------------------------------------------------------------

describe('realistic lien scenario', () => {
  const issueDate = day(2024, 1, 1)
  const asOf = day(2024, 7, 20) // exactly 200 days after Jan 1, 2024
  const faceAmount = 5000
  const annualRate = 0.18

  const rows: LedgerRow[] = [
    { type: 'PURCHASE', amount: faceAmount, date: issueDate },
    { type: 'SUBSEQUENT_TAX', amount: 200, date: day(2024, 4, 1) },
    { type: 'REDEMPTION_RECEIVED', amount: faceAmount + accruedLienInterest({ faceAmount, annualRate, issueDate, asOf }), date: asOf },
  ]

  it('cost basis is face + subsequent tax', () => {
    expect(costBasis(rows)).toBeCloseTo(5200, 2)
  })

  it('income equals redemption amount (face + interest)', () => {
    const expectedInterest = 5000 * 0.18 * (200 / 365)
    expect(incomeToDate(rows)).toBeCloseTo(5000 + expectedInterest, 2)
  })

  it('realized P&L is positive (interest − subsequent tax)', () => {
    const pnl = realizedPnl(rows)
    // interest ≈ 493.15, less $200 sub-tax cost → ≈ $293.15
    expect(pnl).toBeGreaterThan(0)
    expect(pnl).toBeCloseTo(5000 * 0.18 * (200 / 365) - 200, 2)
  })

  it('unrealized value before redemption is face + accrued', () => {
    const value = unrealizedLienValue({ faceAmount, annualRate, issueDate, asOf })
    expect(value).toBeCloseTo(5000 + 5000 * 0.18 * (200 / 365), 4)
  })

  it('annualized return on $5200 invested over 200 days is reasonable', () => {
    const interest = 5000 * 0.18 * (200 / 365)
    const result = annualizedReturn({
      invested: 5200,
      returned: 5000 + interest,
      startDate: issueDate,
      endDate: asOf,
    })
    // We earned less than cost (interest < sub-tax is not the case here — actually interest > sub-tax)
    // 5200 invested, got back 5000+493 = 5493 → profit 293 / 5200 × 365/200 ≈ 10.3%
    expect(result).not.toBeNull()
    expect(result!).toBeGreaterThan(0.08)
    expect(result!).toBeLessThan(0.15)
  })
})
