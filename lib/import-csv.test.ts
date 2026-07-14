import { describe, expect, it } from 'vitest'
import { assertCsvUpload, escapeSpreadsheetFormula, exceedsDeclaredCsvUploadSize, IMPORT_CSV_LIMITS, ImportCsvError, parseImportCsv } from './import-csv'

describe('safe CSV imports', () => {
  it('rejects unsupported and oversized files before text parsing', () => {
    expect(() => assertCsvUpload(new File(['not a workbook'], 'liens.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }))).toThrow('Only CSV files are supported')
    expect(() => assertCsvUpload(new File([new Uint8Array(IMPORT_CSV_LIMITS.maxBytes + 1)], 'liens.csv', {
      type: 'text/csv',
    }))).toThrow('1 MB or smaller')
  })

  it('rejects row, column, and cell limits before object conversion', () => {
    expect(() => parseImportCsv(`state,county\n${Array(IMPORT_CSV_LIMITS.maxRows + 1).fill('FL,Volusia').join('\n')}`)).toThrow(ImportCsvError)
    expect(() => parseImportCsv(`${Array(IMPORT_CSV_LIMITS.maxColumns + 1).fill('x').join(',')}\n${Array(IMPORT_CSV_LIMITS.maxColumns + 1).fill('x').join(',')}`)).toThrow(ImportCsvError)
    expect(() => parseImportCsv(`state,county\nFL,${'x'.repeat(IMPORT_CSV_LIMITS.maxCellLength + 1)}`)).toThrow(ImportCsvError)
  })

  it('keeps formula-like values as text for validation instead of evaluating them', () => {
    expect(parseImportCsv('state,county,notes\nFL,Volusia,"=HYPERLINK(""https://bad"")"')).toEqual([
      { state: 'FL', county: 'Volusia', notes: '=HYPERLINK("https://bad")' },
    ])
  })

  it('neutralizes formula-like cells before CSV export', () => {
    expect(escapeSpreadsheetFormula('=HYPERLINK("https://bad")')).toBe('\'=HYPERLINK("https://bad")')
    expect(escapeSpreadsheetFormula('+123')).toBe("'+123")
    expect(escapeSpreadsheetFormula('normal text')).toBe('normal text')
  })

  it('rejects an oversized declared multipart payload before file parsing', () => {
    expect(exceedsDeclaredCsvUploadSize(null)).toBe(false)
    expect(exceedsDeclaredCsvUploadSize(String(IMPORT_CSV_LIMITS.maxBytes + 64_000))).toBe(false)
    expect(exceedsDeclaredCsvUploadSize(String(IMPORT_CSV_LIMITS.maxBytes + 64_001))).toBe(true)
  })
})
