import { describe, expect, it } from 'vitest'
import { IMPORT_CSV_LIMITS, ImportCsvError, parseImportCsv } from './import-csv'

describe('safe CSV imports', () => {
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
})
