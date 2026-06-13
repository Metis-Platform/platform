import { z } from 'zod'

// ---------------------------------------------------------------------------
// Rent Roll
// ---------------------------------------------------------------------------

export const RentRollUnitSchema = z.object({
  unitNum:     z.string().min(1),
  bedrooms:    z.number().int().min(0),
  sqft:        z.number().positive().nullable(),
  currentRent: z.number().min(0),
  marketRent:  z.number().min(0).nullable(),
  leaseEnd:    z.string().nullable(),
  status:      z.enum(['OCCUPIED', 'VACANT', 'NOTICE']),
})

export const RentRollSchema = z.object({
  units: z.array(RentRollUnitSchema),
})

export type RentRollUnit = z.infer<typeof RentRollUnitSchema>
export type RentRoll = z.infer<typeof RentRollSchema>

/** Compute occupancy metrics from a rent roll. */
export function computeRentRollMetrics(roll: RentRoll) {
  const units = roll.units
  const total = units.length
  const occupied = units.filter(u => u.status === 'OCCUPIED').length
  const occupancyRate = total > 0 ? occupied / total : 0
  const vacancyRate = 1 - occupancyRate

  const gsi = units.reduce((sum, u) => sum + (u.status !== 'VACANT' ? u.currentRent : 0), 0) * 12
  const marketGsi = units.reduce((sum, u) => sum + (u.marketRent ?? u.currentRent), 0) * 12
  const lossToLease = marketGsi - gsi

  const avgRent = occupied > 0
    ? units.filter(u => u.status === 'OCCUPIED').reduce((s, u) => s + u.currentRent, 0) / occupied
    : null

  return { total, occupied, vacancyRate, gsi, marketGsi, lossToLease, avgRent }
}

// ---------------------------------------------------------------------------
// T12 Financials
// ---------------------------------------------------------------------------

export const T12RowSchema = z.object({
  category: z.string().min(1),
  type:     z.enum(['INCOME', 'EXPENSE']),
  values:   z.array(z.number()).length(12),
})

export const T12FinancialsSchema = z.object({
  year: z.number().int().nullable(),
  rows: z.array(T12RowSchema),
})

export type T12Row = z.infer<typeof T12RowSchema>
export type T12Financials = z.infer<typeof T12FinancialsSchema>

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

/** Compute T12 summary metrics. */
export function computeT12Metrics(t12: T12Financials) {
  const income = t12.rows.filter(r => r.type === 'INCOME')
  const expenses = t12.rows.filter(r => r.type === 'EXPENSE')

  const annualIncome = income.reduce((s, r) => s + r.values.reduce((a, b) => a + b, 0), 0)
  const annualExpenses = expenses.reduce((s, r) => s + r.values.reduce((a, b) => a + b, 0), 0)
  const annualNoi = annualIncome - annualExpenses

  const monthlyNoi = Array.from({ length: 12 }, (_, i) => {
    const inc = income.reduce((s, r) => s + r.values[i], 0)
    const exp = expenses.reduce((s, r) => s + r.values[i], 0)
    return inc - exp
  })

  return { annualIncome, annualExpenses, annualNoi, monthlyNoi }
}

/**
 * Parse a T12 CSV string.
 * Expected format: header row "Category,Type,Jan,...,Dec" then data rows.
 * Alternatively: "Category,Jan,...,Dec" with Type inferred by presence in income/expense lists.
 */
export function parseT12Csv(csv: string, year: number | null): T12Financials | null {
  const lines = csv.trim().split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) return null

  const headers = lines[0].split(',').map(h => h.trim())
  const hasType = headers[1]?.toLowerCase() === 'type'
  const monthStart = hasType ? 2 : 1

  if (headers.length < monthStart + 12) return null

  const rows: T12Row[] = []

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim())
    const category = cols[0]
    if (!category) continue

    const type = hasType
      ? (cols[1]?.toUpperCase() === 'EXPENSE' ? 'EXPENSE' : 'INCOME')
      : 'INCOME'

    const values = Array.from({ length: 12 }, (_, j) => {
      const raw = cols[monthStart + j]?.replace(/[$,\s]/g, '')
      return raw ? (parseFloat(raw) || 0) : 0
    })

    const parsed = T12RowSchema.safeParse({ category, type, values })
    if (parsed.success) rows.push(parsed.data)
  }

  if (rows.length === 0) return null
  return { year, rows }
}
