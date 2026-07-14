import { parseCsv, rowsToObjects } from './csv'

export const IMPORT_CSV_LIMITS = {
  maxBytes: 1_000_000,
  maxRows: 500,
  maxColumns: 24,
  maxCellLength: 2_000,
} as const

export class ImportCsvError extends Error {}

export function assertCsvUpload(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase()
  const type = file.type.toLowerCase()
  if (extension !== 'csv' || (type && !['text/csv', 'application/csv', 'text/plain'].includes(type))) {
    throw new ImportCsvError('Only CSV files are supported. Export your spreadsheet as CSV and try again.')
  }
  if (file.size === 0) throw new ImportCsvError('The CSV file is empty.')
  if (file.size > IMPORT_CSV_LIMITS.maxBytes) {
    throw new ImportCsvError('CSV files must be 1 MB or smaller.')
  }
}

export function parseImportCsv(text: string): Record<string, string>[] {
  const rows = parseCsv(text)
  if (rows.length < 2) return []
  if (rows.length - 1 > IMPORT_CSV_LIMITS.maxRows) {
    throw new ImportCsvError(`CSV files may contain at most ${IMPORT_CSV_LIMITS.maxRows} data rows.`)
  }
  for (const row of rows) {
    if (row.length > IMPORT_CSV_LIMITS.maxColumns) {
      throw new ImportCsvError(`CSV files may contain at most ${IMPORT_CSV_LIMITS.maxColumns} columns.`)
    }
    if (row.some(cell => cell.length > IMPORT_CSV_LIMITS.maxCellLength)) {
      throw new ImportCsvError(`CSV cells may contain at most ${IMPORT_CSV_LIMITS.maxCellLength} characters.`)
    }
  }
  return rowsToObjects(rows)
}

export function escapeSpreadsheetFormula(value: string) {
  return /^[=+\-@]/.test(value) ? `'${value}` : value
}
