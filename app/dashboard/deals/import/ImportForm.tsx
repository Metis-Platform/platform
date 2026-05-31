'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { ImportRow } from '@/app/api/liens/import/route'

type PreviewResult = { rows: ImportRow[]; total: number; valid: number }
type ImportResult  = { imported: number; skipped: number; errors: { rowNum: number; error: string }[] }

type Phase = 'idle' | 'parsing' | 'preview' | 'importing' | 'done'

export default function ImportForm() {
  const [phase, setPhase]         = useState<Phase>('idle')
  const [preview, setPreview]     = useState<PreviewResult | null>(null)
  const [result, setResult]       = useState<ImportResult | null>(null)
  const [error, setError]         = useState<string | null>(null)
  const [file, setFile]           = useState<File | null>(null)
  const [isSubmitting, setSubmit] = useState(false)
  const inputRef                  = useRef<HTMLInputElement>(null)
  const router                    = useRouter()

  async function handleFile(f: File) {
    setFile(f)
    setError(null)
    setPhase('parsing')

    const fd = new FormData()
    fd.append('file', f)

    try {
      const res = await fetch('/api/liens/import?preview=true', { method: 'POST', body: fd })
      const data = await res.json() as PreviewResult | { error: string }
      if (!res.ok) { setError((data as { error: string }).error); setPhase('idle'); return }
      setPreview(data as PreviewResult)
      setPhase('preview')
    } catch {
      setError('Failed to parse CSV. Check your network connection.')
      setPhase('idle')
    }
  }

  async function handleImport() {
    if (!file || !preview) return
    setSubmit(true)

    const fd = new FormData()
    fd.append('file', file)

    try {
      const res = await fetch('/api/liens/import', { method: 'POST', body: fd })
      const data = await res.json() as ImportResult | { error: string }
      if (!res.ok) { setError((data as { error: string }).error); setSubmit(false); return }
      setResult(data as ImportResult)
      setPhase('done')
    } catch {
      setError('Import failed. Please try again.')
      setSubmit(false)
    }
  }

  function reset() {
    setPhase('idle')
    setPreview(null)
    setResult(null)
    setError(null)
    setFile(null)
  }

  // --- Done screen ---
  if (phase === 'done' && result) {
    return (
      <div className="bg-white rounded-xl border border-zinc-200 p-8 text-center">
        <div className="text-4xl mb-3">✅</div>
        <h2 className="text-lg font-semibold text-zinc-900 mb-1">Import complete</h2>
        <p className="text-sm text-zinc-500 mb-4">
          <span className="text-green-600 font-semibold">{result.imported}</span> liens imported
          {result.skipped > 0 && <>, <span className="text-red-500 font-semibold">{result.skipped}</span> skipped due to errors</>}
        </p>
        {result.errors.length > 0 && (
          <div className="mb-4 text-left bg-red-50 border border-red-200 rounded-lg p-3">
            {result.errors.map(e => (
              <p key={e.rowNum} className="text-xs text-red-600">Row {e.rowNum}: {e.error}</p>
            ))}
          </div>
        )}
        <div className="flex justify-center gap-3">
          <button onClick={reset} className="px-4 py-2 text-sm font-medium text-zinc-700 border border-zinc-300 rounded-lg hover:bg-zinc-50">
            Import Another File
          </button>
          <button onClick={() => router.push('/dashboard/deals')} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
            View Liens →
          </button>
        </div>
      </div>
    )
  }

  // --- Preview screen ---
  if (phase === 'preview' && preview) {
    const validRows   = preview.rows.filter(r => r.valid)
    const invalidRows = preview.rows.filter(r => !r.valid)

    return (
      <div>
        <div className="bg-white rounded-xl border border-zinc-200 p-5 mb-4">
          <h2 className="text-sm font-semibold text-zinc-900 mb-1">Step 2 — Review and import</h2>
          <p className="text-sm text-zinc-500">
            Found <span className="font-medium">{preview.total}</span> rows —{' '}
            <span className="text-green-600 font-medium">{validRows.length} valid</span>
            {invalidRows.length > 0 && <>, <span className="text-red-500 font-medium">{invalidRows.length} with errors</span></>}.
            {' '}Rows with errors will be skipped.
          </p>
        </div>

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

        {/* Error rows first */}
        {invalidRows.length > 0 && (
          <div className="mb-4">
            <h3 className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-2">Rows with errors ({invalidRows.length})</h3>
            <div className="bg-red-50 rounded-xl border border-red-200 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-red-200 text-left text-red-400 font-semibold uppercase tracking-wide">
                    <th className="px-3 py-2">Row</th>
                    <th className="px-3 py-2">APN</th>
                    <th className="px-3 py-2">Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-red-100">
                  {invalidRows.map(row => (
                    <tr key={row.rowNum}>
                      <td className="px-3 py-2 text-red-400">{row.rowNum}</td>
                      <td className="px-3 py-2 font-mono text-red-700">{row.raw.apn || '—'}</td>
                      <td className="px-3 py-2 text-red-600">{row.errors.join('; ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Valid rows */}
        {validRows.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2">Valid rows ({validRows.length})</h3>
            <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-zinc-400 font-semibold uppercase tracking-wide">
                    <th className="px-3 py-2">APN</th>
                    <th className="px-3 py-2">Jurisdiction</th>
                    <th className="px-3 py-2">Cert #</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                    <th className="px-3 py-2">Rate</th>
                    <th className="px-3 py-2">Issue Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {validRows.slice(0, 50).map(row => (
                    <tr key={row.rowNum} className="text-zinc-700">
                      <td className="px-3 py-2 font-mono">{row.data!.apn}</td>
                      <td className="px-3 py-2">{row.data!.county}, {row.data!.state}</td>
                      <td className="px-3 py-2 font-mono">{row.data!.certificate_number}</td>
                      <td className="px-3 py-2 text-right">${row.data!.face_amount.toLocaleString()}</td>
                      <td className="px-3 py-2">{row.data!.interest_rate}%</td>
                      <td className="px-3 py-2">{row.data!.issue_date}</td>
                    </tr>
                  ))}
                  {validRows.length > 50 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-2 text-zinc-400 text-center">
                        … and {validRows.length - 50} more
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={handleImport}
            disabled={validRows.length === 0 || isSubmitting}
            className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? 'Importing…' : `Import ${validRows.length} Lien${validRows.length !== 1 ? 's' : ''}`}
          </button>
          <button onClick={reset} className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900">
            ← Choose a different file
          </button>
        </div>
      </div>
    )
  }

  // --- Upload screen ---
  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-5">
      <h2 className="text-sm font-semibold text-zinc-900 mb-3">Step 2 — Upload your CSV</h2>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      <div
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
          phase === 'parsing' ? 'border-blue-300 bg-blue-50' : 'border-zinc-200 hover:border-zinc-300 bg-zinc-50'
        }`}
        onClick={() => phase === 'idle' && inputRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}
        />
        {phase === 'parsing' ? (
          <p className="text-sm text-blue-600">Parsing CSV…</p>
        ) : (
          <>
            <svg className="mx-auto mb-2 w-8 h-8 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <p className="text-sm text-zinc-500">Drag & drop your CSV, or <span className="text-blue-600">browse</span></p>
            <p className="text-xs text-zinc-400 mt-1">Up to 500 liens per file</p>
          </>
        )}
      </div>
    </div>
  )
}
