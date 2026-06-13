import { describe, it, expect } from 'vitest'
import { amortizationSchedule, payoffQuote, notePortfolioMetrics, type NoteForServicing } from './land-note-servicing'

const baseNote: NoteForServicing = {
  principal:        10000,
  interestRate:     0.08,   // 8%
  termMonths:       12,
  paymentAmount:    869.88, // standard 12-month payment for $10k @ 8%
  firstPaymentDate: new Date('2024-02-01'),
  balance:          10000,
}

describe('amortizationSchedule', () => {
  it('returns correct number of rows', () => {
    const rows = amortizationSchedule(baseNote)
    expect(rows.length).toBe(12)
  })

  it('first payment splits correctly', () => {
    const [first] = amortizationSchedule(baseNote)
    const expectedInterest = parseFloat((10000 * (0.08 / 12)).toFixed(2))
    expect(first.interest).toBeCloseTo(expectedInterest, 2)
    expect(first.principal).toBeCloseTo(first.payment - first.interest, 2)
  })

  it('balance reaches near-zero by final payment (within $1)', () => {
    const rows = amortizationSchedule(baseNote)
    expect(rows[rows.length - 1].balance).toBeLessThan(1)
  })

  it('payment dates advance by one month each row', () => {
    const rows = amortizationSchedule(baseNote)
    const msPerMonth = (i: number) => rows[i].paymentDate.getTime()
    // Each successive date is ~28-31 days after the previous
    const diff = msPerMonth(1) - msPerMonth(0)
    expect(diff).toBeGreaterThan(27 * 86400 * 1000)
    expect(diff).toBeLessThan(32 * 86400 * 1000)
  })
})

describe('payoffQuote', () => {
  const partialNote: NoteForServicing = { ...baseNote, balance: 5000 }

  it('computes per-diem interest', () => {
    const quote = payoffQuote(partialNote, new Date('2024-06-01'))
    const expectedPerDiem = parseFloat((5000 * (0.08 / 365)).toFixed(4))
    expect(quote.perDiemInterest).toBeCloseTo(expectedPerDiem, 4)
  })

  it('total payoff = balance + per-diem × honorDays', () => {
    const quote = payoffQuote(partialNote, new Date('2024-06-01'), 10)
    expect(quote.totalPayoff).toBeCloseTo(quote.outstandingBalance + quote.perDiemInterest * 10, 2)
  })

  it('uses custom honorDays', () => {
    const q30 = payoffQuote(partialNote, new Date('2024-06-01'), 30)
    const q10 = payoffQuote(partialNote, new Date('2024-06-01'), 10)
    expect(q30.totalPayoff).toBeGreaterThan(q10.totalPayoff)
  })
})

describe('notePortfolioMetrics', () => {
  const notes = [
    { principal: 10000, balance: 7500, interestRate: 0.08, status: 'ACTIVE' },
    { principal: 20000, balance: 15000, interestRate: 0.10, status: 'ACTIVE' },
    { principal: 5000,  balance: 4000,  interestRate: 0.09, status: 'DELINQUENT' },
  ]
  const payments = [{ amount: 1000 }, { amount: 2000 }, { amount: 500 }]

  it('counts notes and active correctly', () => {
    const m = notePortfolioMetrics(notes, payments)
    expect(m.totalNotes).toBe(3)
    expect(m.activeNotes).toBe(2)
    expect(m.delinquentCount).toBe(1)
  })

  it('computes delinquency rate', () => {
    const m = notePortfolioMetrics(notes, payments)
    expect(m.delinquencyRatePct).toBeCloseTo(33.3, 0)
  })

  it('sums outstanding balance over active notes only', () => {
    const m = notePortfolioMetrics(notes, payments)
    expect(m.totalOutstandingBalance).toBe(22500)
  })

  it('computes average yield over active notes', () => {
    const m = notePortfolioMetrics(notes, payments)
    expect(m.averageYieldPct).toBeCloseTo(9.0, 1) // (8+10)/2 = 9%
  })

  it('sums total collected', () => {
    const m = notePortfolioMetrics(notes, payments)
    expect(m.totalCollected).toBe(3500)
  })
})
