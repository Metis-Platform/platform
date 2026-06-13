export type NoteForServicing = {
  principal: number
  interestRate: number  // stored as fraction, e.g. 0.08 = 8%
  termMonths: number
  paymentAmount: number
  firstPaymentDate: Date
  balance: number
}

export type AmortizationRow = {
  paymentNum: number
  paymentDate: Date
  payment: number
  principal: number
  interest: number
  balance: number
}

/** Build a complete amortization schedule from note terms. */
export function amortizationSchedule(note: NoteForServicing): AmortizationRow[] {
  const { interestRate, termMonths, paymentAmount, firstPaymentDate } = note
  const monthlyRate = interestRate / 12
  const rows: AmortizationRow[] = []

  let balance = note.principal
  let paymentDate = new Date(firstPaymentDate)

  for (let i = 1; i <= termMonths && balance > 0.005; i++) {
    const interest = balance * monthlyRate
    const principalPaid = Math.min(paymentAmount - interest, balance)
    balance = Math.max(0, balance - principalPaid)

    rows.push({
      paymentNum:  i,
      paymentDate: new Date(paymentDate),
      payment:     parseFloat((Math.min(paymentAmount, principalPaid + interest)).toFixed(2)),
      principal:   parseFloat(principalPaid.toFixed(2)),
      interest:    parseFloat(interest.toFixed(2)),
      balance:     parseFloat(balance.toFixed(2)),
    })

    // Advance one month
    const next = new Date(paymentDate)
    next.setMonth(next.getMonth() + 1)
    paymentDate = next
  }

  return rows
}

export type PayoffQuote = {
  asOfDate: Date
  outstandingBalance: number
  perDiemInterest: number
  daysToPayoff: number
  totalPayoff: number
}

/**
 * Compute a payoff quote accurate to the day.
 * daysToPayoff = days from asOfDate until the quote is honored (default 10).
 */
export function payoffQuote(
  note: NoteForServicing,
  asOfDate: Date,
  honorDays = 10,
): PayoffQuote {
  const dailyRate = note.interestRate / 365
  const perDiemInterest = note.balance * dailyRate
  const totalPayoff = note.balance + perDiemInterest * honorDays

  return {
    asOfDate,
    outstandingBalance: parseFloat(note.balance.toFixed(2)),
    perDiemInterest:    parseFloat(perDiemInterest.toFixed(4)),
    daysToPayoff:       honorDays,
    totalPayoff:        parseFloat(totalPayoff.toFixed(2)),
  }
}

export type NotePortfolioMetrics = {
  totalNotes: number
  activeNotes: number
  totalPrincipalOriginated: number
  totalOutstandingBalance: number
  totalCollected: number
  averageYieldPct: number | null
  delinquentCount: number
  delinquencyRatePct: number
}

/** Aggregate metrics across all notes and their payments. */
export function notePortfolioMetrics(
  notes: { principal: number; balance: number; interestRate: number; status: string }[],
  payments: { amount: number }[],
): NotePortfolioMetrics {
  const activeNotes = notes.filter(n => n.status === 'ACTIVE')
  const delinquentCount = notes.filter(n => n.status === 'DELINQUENT').length
  const totalPrincipalOriginated = notes.reduce((s, n) => s + n.principal, 0)
  const totalOutstandingBalance = activeNotes.reduce((s, n) => s + n.balance, 0)
  const totalCollected = payments.reduce((s, p) => s + p.amount, 0)

  const avgYield = activeNotes.length > 0
    ? activeNotes.reduce((s, n) => s + n.interestRate, 0) / activeNotes.length
    : null

  return {
    totalNotes:               notes.length,
    activeNotes:              activeNotes.length,
    totalPrincipalOriginated: parseFloat(totalPrincipalOriginated.toFixed(2)),
    totalOutstandingBalance:  parseFloat(totalOutstandingBalance.toFixed(2)),
    totalCollected:           parseFloat(totalCollected.toFixed(2)),
    averageYieldPct:          avgYield != null ? parseFloat((avgYield * 100).toFixed(2)) : null,
    delinquentCount,
    delinquencyRatePct:       notes.length > 0 ? parseFloat(((delinquentCount / notes.length) * 100).toFixed(1)) : 0,
  }
}
