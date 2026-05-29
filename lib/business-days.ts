/**
 * business-days.ts
 *
 * Deadline date arithmetic for Metis Platform.
 *
 * Statutory tax lien deadlines are measured in calendar days. When the raw
 * calculated date falls on a US federal holiday or a weekend, it shifts forward
 * to the next business day — the standard legal interpretation for most
 * jurisdictions.
 */

// ---------------------------------------------------------------------------
// Holiday computation (US federal holidays, 2024–2035)
// ---------------------------------------------------------------------------

/** Returns the date of the nth occurrence of `dayOfWeek` in a given month/year. */
function nthWeekdayOfMonth(year: number, month: number, dayOfWeek: number, n: number): Date {
  const d = new Date(year, month - 1, 1)
  let count = 0
  while (true) {
    if (d.getDay() === dayOfWeek) {
      count++
      if (count === n) return new Date(d)
    }
    d.setDate(d.getDate() + 1)
  }
}

/** Returns the last occurrence of `dayOfWeek` in a given month/year. */
function lastWeekdayOfMonth(year: number, month: number, dayOfWeek: number): Date {
  const d = new Date(year, month, 0) // last day of month
  while (d.getDay() !== dayOfWeek) {
    d.setDate(d.getDate() - 1)
  }
  return new Date(d)
}

/** When a fixed holiday falls on a weekend, return the observed date. */
function observedDate(year: number, month: number, day: number): Date {
  const d = new Date(year, month - 1, day)
  const dow = d.getDay()
  if (dow === 6) d.setDate(d.getDate() - 1) // Saturday → Friday
  if (dow === 0) d.setDate(d.getDate() + 1) // Sunday → Monday
  return d
}

function toKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Build the Set of US federal holiday date strings for a given year. */
function usFederalHolidays(year: number): Set<string> {
  const dates = [
    observedDate(year, 1, 1),                                // New Year's Day
    nthWeekdayOfMonth(year, 1, 1, 3),                        // MLK Day (3rd Mon Jan)
    nthWeekdayOfMonth(year, 2, 1, 3),                        // Presidents Day (3rd Mon Feb)
    lastWeekdayOfMonth(year, 5, 1),                          // Memorial Day (last Mon May)
    observedDate(year, 6, 19),                               // Juneteenth
    observedDate(year, 7, 4),                                // Independence Day
    nthWeekdayOfMonth(year, 9, 1, 1),                        // Labor Day (1st Mon Sep)
    nthWeekdayOfMonth(year, 10, 1, 2),                       // Columbus Day (2nd Mon Oct)
    observedDate(year, 11, 11),                              // Veterans Day
    nthWeekdayOfMonth(year, 11, 4, 4),                       // Thanksgiving (4th Thu Nov)
    observedDate(year, 12, 25),                              // Christmas
  ]
  return new Set(dates.map(toKey))
}

// Cache holidays per year to avoid recomputing in loops.
const holidayCache = new Map<number, Set<string>>()

function isHoliday(date: Date): boolean {
  const year = date.getFullYear()
  if (!holidayCache.has(year)) {
    holidayCache.set(year, usFederalHolidays(year))
  }
  return holidayCache.get(year)!.has(toKey(date))
}

function isWeekend(date: Date): boolean {
  const dow = date.getDay()
  return dow === 0 || dow === 6
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Adds `offsetDays` calendar days to `anchor`, then advances to the next
 * US business day if the result falls on a weekend or federal holiday.
 *
 * This matches the standard legal interpretation for most US jurisdictions:
 * deadlines are counted in calendar days and shift forward when they fall
 * on a non-business day.
 */
export function calculateEventDueDate(anchor: Date, offsetDays: number): Date {
  const raw = new Date(anchor)
  raw.setDate(raw.getDate() + offsetDays)

  // Advance past weekends and holidays
  while (isWeekend(raw) || isHoliday(raw)) {
    raw.setDate(raw.getDate() + 1)
  }

  return raw
}

/** Returns true if `date` is a US business day (not weekend, not federal holiday). */
export function isBusinessDay(date: Date): boolean {
  return !isWeekend(date) && !isHoliday(date)
}
