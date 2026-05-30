/**
 * Minimal RFC 4180 CSV parser.
 * Returns an array of string arrays (rows × cells).
 * Handles quoted fields containing commas and newlines.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false
  const n = text.length

  for (let i = 0; i < n; i++) {
    const ch = text[i]
    const next = text[i + 1]

    if (inQuotes) {
      if (ch === '"' && next === '"') { cell += '"'; i++ }         // escaped quote
      else if (ch === '"') { inQuotes = false }                     // end of quoted field
      else { cell += ch }
    } else {
      if (ch === '"') { inQuotes = true }
      else if (ch === ',') { row.push(cell.trim()); cell = '' }
      else if (ch === '\n' || (ch === '\r' && next === '\n')) {
        row.push(cell.trim()); cell = ''
        if (row.some(c => c !== '')) rows.push(row)                 // skip blank lines
        row = []
        if (ch === '\r') i++                                        // consume \r\n as one
      } else { cell += ch }
    }
  }
  // Last field / row
  row.push(cell.trim())
  if (row.some(c => c !== '')) rows.push(row)

  return rows
}

/** Convert parsed rows + header row into an array of objects. */
export function rowsToObjects(rows: string[][]): Record<string, string>[] {
  if (rows.length < 2) return []
  const headers = rows[0].map(h => h.toLowerCase().replace(/\s+/g, '_'))
  return rows.slice(1).map(row => {
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => { obj[h] = row[i] ?? '' })
    return obj
  })
}
