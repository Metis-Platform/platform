'use client'

import { useState, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { applyLienExtraction, applyDeedExtraction } from '@/lib/actions/ai-extract'

export type DocRow = {
  id: string
  fileName: string
  fileSize: number
  mimeType: string
  docType: string
  uploadedAt: string  // ISO
}

const DOC_TYPE_LABELS: Record<string, string> = {
  LIEN_CERTIFICATE:  'Lien Certificate',
  TAX_DEED:          'Tax Deed',
  PURCHASE_CONTRACT: 'Purchase Contract',
  NOTICE_LETTER:     'Notice Letter',
  USPS_RECEIPT:      'USPS Receipt',
  COURT_FILING:      'Court Filing',
  TITLE_REPORT:      'Title Report',
  DEED:              'Deed',
  LEASE:             'Lease',
  OTHER:             'Other',
}

const DOC_TYPE_COLOR: Record<string, string> = {
  LIEN_CERTIFICATE:  'bg-blue-100 text-blue-700',
  TAX_DEED:          'bg-indigo-100 text-indigo-700',
  PURCHASE_CONTRACT: 'bg-violet-100 text-violet-700',
  NOTICE_LETTER:     'bg-yellow-100 text-yellow-700',
  USPS_RECEIPT:      'bg-orange-100 text-orange-700',
  COURT_FILING:      'bg-red-100 text-red-700',
  TITLE_REPORT:      'bg-teal-100 text-teal-700',
  DEED:              'bg-emerald-100 text-emerald-700',
  LEASE:             'bg-cyan-100 text-cyan-700',
  OTHER:             'bg-zinc-100 text-zinc-600',
}

const ALLOWED_EXTENSIONS = '.pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx,.txt,.csv'
const MAX_BYTES = 10 * 1024 * 1024  // 10 MB

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function fileIcon(mimeType: string) {
  if (mimeType === 'application/pdf') return '📄'
  if (mimeType.startsWith('image/')) return '🖼️'
  if (mimeType.includes('word')) return '📝'
  if (mimeType.includes('sheet') || mimeType.includes('csv')) return '📊'
  return '📎'
}

function confidenceClass(confidence: number) {
  if (confidence >= 0.8) return 'bg-green-100 text-green-700'
  if (confidence >= 0.5) return 'bg-yellow-100 text-yellow-700'
  return 'bg-red-100 text-red-700'
}

function confidenceLabel(confidence: number) {
  if (confidence >= 0.8) return 'High'
  if (confidence >= 0.5) return 'Med'
  return 'Low'
}

type FieldResult = { value: string | number | null; confidence: number }
type ExtractionResult = { fields: Record<string, FieldResult> }

const LIEN_FIELD_LABELS: Record<string, string> = {
  certificateNumber: 'Certificate #',
  apn:              'APN',
  faceAmount:       'Face Amount ($)',
  interestRate:     'Interest Rate (%)',
  issueDate:        'Issue Date',
  state:            'State',
  county:           'County',
  ownerName:        'Owner Name',
}

const DEED_FIELD_LABELS: Record<string, string> = {
  apn:         'APN',
  saleDate:    'Sale Date',
  winningBid:  'Winning Bid ($)',
  openingBid:  'Opening Bid ($)',
  state:       'State',
  county:      'County',
  grantorName: 'Grantor Name',
}

// Fields that can be written back to the deal extension table
const LIEN_APPLY_FIELDS = new Set(['certificateNumber', 'faceAmount', 'interestRate', 'issueDate'])
const DEED_APPLY_FIELDS = new Set(['saleDate', 'winningBid', 'openingBid'])

type UploadState = { status: 'idle' } | { status: 'uploading'; progress: number } | { status: 'error'; message: string }

type ExtractState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string; settingsUrl?: string }
  | { status: 'review'; docId: string; docType: string; result: ExtractionResult; edited: Record<string, string>; applying: boolean; applyError?: string }

export default function DocumentSection({ dealId, initialDocs }: { dealId: string; initialDocs: DocRow[] }) {
  const [docs, setDocs] = useState<DocRow[]>(initialDocs)
  const [uploadState, setUploadState] = useState<UploadState>({ status: 'idle' })
  const [selectedDocType, setSelectedDocType] = useState<string>('LIEN_CERTIFICATE')
  const [dragOver, setDragOver] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [extractState, setExtractState] = useState<ExtractState>({ status: 'idle' })
  const inputRef = useRef<HTMLInputElement>(null)
  const [, startTransition] = useTransition()
  const router = useRouter()

  async function handleFile(file: File) {
    if (file.size > MAX_BYTES) {
      setUploadState({ status: 'error', message: 'File must be under 10 MB.' })
      return
    }
    setUploadState({ status: 'uploading', progress: 0 })
    try {
      const presignRes = await fetch('/api/documents/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealId,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || 'application/octet-stream',
          docType: selectedDocType,
        }),
      })
      if (!presignRes.ok) {
        const err = await presignRes.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error ?? 'Failed to get upload URL')
      }
      const { uploadUrl, r2Key } = await presignRes.json() as { uploadUrl: string; r2Key: string }

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', uploadUrl)
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
        xhr.upload.onprogress = e => {
          if (e.lengthComputable) setUploadState({ status: 'uploading', progress: Math.round(e.loaded / e.total * 100) })
        }
        xhr.onload = () => xhr.status < 300 ? resolve() : reject(new Error(`R2 upload failed: ${xhr.status}`))
        xhr.onerror = () => reject(new Error('Network error during upload'))
        xhr.send(file)
      })

      const docRes = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealId,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || 'application/octet-stream',
          r2Key,
          docType: selectedDocType,
        }),
      })
      if (!docRes.ok) throw new Error('Failed to save document record')
      const newDoc = await docRes.json() as DocRow

      setDocs(prev => [newDoc, ...prev])
      setUploadState({ status: 'idle' })
      startTransition(() => router.refresh())
    } catch (err) {
      setUploadState({ status: 'error', message: err instanceof Error ? err.message : 'Upload failed' })
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  async function handleDelete(doc: DocRow) {
    if (!confirm(`Delete "${doc.fileName}"? This cannot be undone.`)) return
    setDeletingId(doc.id)
    try {
      const res = await fetch(`/api/documents/${doc.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      setDocs(prev => prev.filter(d => d.id !== doc.id))
      startTransition(() => router.refresh())
    } catch {
      alert('Failed to delete document. Please try again.')
    } finally {
      setDeletingId(null)
    }
  }

  async function handleExtract(doc: DocRow) {
    setExtractState({ status: 'loading' })
    try {
      const res = await fetch('/api/ai/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: doc.id }),
      })
      const data = await res.json() as { error?: string; settingsUrl?: string; fields?: Record<string, FieldResult> }

      if (!res.ok) {
        setExtractState({ status: 'error', message: data.error ?? 'Extraction failed', settingsUrl: data.settingsUrl })
        return
      }

      const result = data as unknown as ExtractionResult
      const edited: Record<string, string> = {}
      for (const [key, field] of Object.entries(result.fields ?? {})) {
        edited[key] = field.value != null ? String(field.value) : ''
      }
      setExtractState({ status: 'review', docId: doc.id, docType: doc.docType, result, edited, applying: false })
    } catch {
      setExtractState({ status: 'error', message: 'Network error during extraction' })
    }
  }

  async function handleApply() {
    if (extractState.status !== 'review') return
    const { docType, edited } = extractState
    setExtractState({ ...extractState, applying: true, applyError: undefined })

    let error: string | undefined
    if (docType === 'LIEN_CERTIFICATE') {
      const res = await applyLienExtraction(dealId, {
        certificateNumber: edited.certificateNumber || null,
        faceAmount:        edited.faceAmount        || null,
        interestRate:      edited.interestRate       || null,
        issueDate:         edited.issueDate          || null,
      })
      error = res.error
    } else {
      const res = await applyDeedExtraction(dealId, {
        saleDate:   edited.saleDate   || null,
        winningBid: edited.winningBid || null,
        openingBid: edited.openingBid || null,
      })
      error = res.error
    }

    if (error) {
      setExtractState({ ...extractState, applying: false, applyError: error })
      return
    }

    setExtractState({ status: 'idle' })
    startTransition(() => router.refresh())
  }

  const isUploading = uploadState.status === 'uploading'
  const fieldLabels = (extractState.status === 'review' && extractState.docType === 'TAX_DEED')
    ? DEED_FIELD_LABELS
    : LIEN_FIELD_LABELS
  const applyFields = (extractState.status === 'review' && extractState.docType === 'TAX_DEED')
    ? DEED_APPLY_FIELDS
    : LIEN_APPLY_FIELDS

  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-6">
      <h2 className="text-sm font-semibold text-zinc-900 mb-4">
        Documents
        {docs.length > 0 && <span className="ml-2 text-xs font-normal text-zinc-400">{docs.length} file{docs.length !== 1 ? 's' : ''}</span>}
      </h2>

      {/* Upload area */}
      <div className="mb-5">
        <div className="flex items-center gap-3 mb-3">
          <label className="text-xs text-zinc-500 font-medium">Type</label>
          <select
            value={selectedDocType}
            onChange={e => setSelectedDocType(e.target.value)}
            disabled={isUploading}
            className="text-sm border border-zinc-200 rounded-lg px-2 py-1 bg-white text-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {Object.entries(DOC_TYPE_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>

        <div
          className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
            dragOver ? 'border-blue-400 bg-blue-50' : 'border-zinc-200 hover:border-zinc-300 bg-zinc-50'
          } ${isUploading ? 'pointer-events-none opacity-70' : 'cursor-pointer'}`}
          onClick={() => !isUploading && inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ALLOWED_EXTENSIONS}
            className="hidden"
            onChange={onInputChange}
          />
          {isUploading ? (
            <div>
              <div className="text-sm text-zinc-600 mb-2">Uploading…</div>
              <div className="w-full bg-zinc-200 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-blue-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${(uploadState as { progress: number }).progress}%` }}
                />
              </div>
              <div className="text-xs text-zinc-400 mt-1">{(uploadState as { progress: number }).progress}%</div>
            </div>
          ) : (
            <>
              <svg className="mx-auto mb-2 w-8 h-8 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <p className="text-sm text-zinc-500">Drag & drop a file, or <span className="text-blue-600">browse</span></p>
              <p className="text-xs text-zinc-400 mt-1">PDF, JPEG, PNG, DOCX, XLSX, CSV — up to 10 MB</p>
            </>
          )}
        </div>
        {uploadState.status === 'error' && (
          <p className="text-xs text-red-600 mt-2">{uploadState.message}</p>
        )}
      </div>

      {/* Extraction error */}
      {extractState.status === 'error' && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center justify-between gap-3">
          <span>
            {extractState.message}
            {extractState.settingsUrl && (
              <a href={extractState.settingsUrl} className="ml-1 font-medium underline hover:text-red-900">
                Add your API key in Settings →
              </a>
            )}
          </span>
          <button onClick={() => setExtractState({ status: 'idle' })} className="text-red-400 hover:text-red-600 flex-shrink-0">✕</button>
        </div>
      )}

      {/* Extraction in progress */}
      {extractState.status === 'loading' && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          Extracting fields with AI — this may take a few seconds.
        </div>
      )}

      {/* Document list */}
      {docs.length === 0 ? (
        <p className="text-sm text-zinc-400">No documents uploaded yet.</p>
      ) : (
        <ul className="space-y-2">
          {docs.map(doc => (
            <li key={doc.id} className="flex items-center gap-3 p-3 rounded-lg border border-zinc-100 bg-zinc-50 hover:bg-zinc-100 transition-colors group">
              <span className="text-xl flex-shrink-0">{fileIcon(doc.mimeType)}</span>
              <div className="flex-1 min-w-0">
                <a
                  href={`/api/documents/${doc.id}/download`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-blue-600 hover:underline truncate block"
                >
                  {doc.fileName}
                </a>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${DOC_TYPE_COLOR[doc.docType] ?? 'bg-zinc-100 text-zinc-600'}`}>
                    {DOC_TYPE_LABELS[doc.docType] ?? doc.docType}
                  </span>
                  <span className="text-xs text-zinc-400">{formatBytes(doc.fileSize)}</span>
                  <span className="text-xs text-zinc-400">
                    {new Date(doc.uploadedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {(doc.docType === 'LIEN_CERTIFICATE' || doc.docType === 'TAX_DEED') && (
                  <button
                    onClick={() => handleExtract(doc)}
                    disabled={extractState.status === 'loading'}
                    className="opacity-0 group-hover:opacity-100 px-2 py-1 text-xs font-medium text-violet-600 hover:text-violet-800 border border-violet-200 hover:border-violet-400 rounded-md transition-all disabled:opacity-50"
                    title="Extract fields with AI"
                  >
                    Extract
                  </button>
                )}
                <button
                  onClick={() => handleDelete(doc)}
                  disabled={deletingId === doc.id}
                  className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-500 transition-all text-sm disabled:opacity-50 px-1"
                  title="Delete"
                >
                  {deletingId === doc.id ? '…' : '✕'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Extraction review modal */}
      {extractState.status === 'review' && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-zinc-900">Extracted Fields</h3>
                <button onClick={() => setExtractState({ status: 'idle' })} className="text-zinc-400 hover:text-zinc-700 text-lg leading-none">✕</button>
              </div>
              <p className="text-xs text-zinc-500 mb-4">
                Review and edit extracted values. Fields marked <span className="text-violet-600 font-medium">writable</span> will be saved to the deal when you click Apply.
              </p>
              <div className="space-y-3">
                {Object.entries(extractState.result.fields).map(([key, field]) => (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-zinc-600">
                        {fieldLabels[key] ?? key}
                        {applyFields.has(key) && (
                          <span className="ml-1.5 text-violet-500 text-[10px] font-semibold">writable</span>
                        )}
                      </label>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${confidenceClass(field.confidence)}`}>
                        {confidenceLabel(field.confidence)}
                      </span>
                    </div>
                    <input
                      type="text"
                      value={extractState.edited[key] ?? ''}
                      onChange={e => {
                        if (extractState.status !== 'review') return
                        setExtractState({ ...extractState, edited: { ...extractState.edited, [key]: e.target.value } })
                      }}
                      placeholder={field.value == null ? 'Not found' : ''}
                      className="w-full text-sm border border-zinc-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                ))}
              </div>
              {extractState.applyError && (
                <p className="mt-3 text-xs text-red-600">{extractState.applyError}</p>
              )}
              <div className="flex gap-2 mt-5">
                <button
                  onClick={handleApply}
                  disabled={extractState.applying}
                  className="flex-1 py-2 text-sm font-medium bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 disabled:opacity-50 transition-colors"
                >
                  {extractState.applying ? 'Applying…' : 'Apply to Deal'}
                </button>
                <button
                  onClick={() => setExtractState({ status: 'idle' })}
                  disabled={extractState.applying}
                  className="px-4 py-2 text-sm font-medium text-zinc-600 border border-zinc-300 rounded-lg hover:bg-zinc-50 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
