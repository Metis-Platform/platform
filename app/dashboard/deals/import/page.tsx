import Link from 'next/link'
import ImportForm from './ImportForm'

// Template CSV content with status column (first column)
const TEMPLATE_CSV =
  'status,state,county,apn,certificate_number,face_amount,interest_rate,issue_date,address,notes\r\n' +
  'ACTIVE,FL,Miami-Dade,12-3456-789-0001,2024-0001,5000,18,2024-06-15,123 Main St Miami FL 33101,\r\n' +
  'LEAD,FL,Miami-Dade,12-3456-789-0002,,,,,456 Oak Ave Miami FL 33102,Pre-auction lead\r\n'

const TEMPLATE_DATA_URL = `data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE_CSV)}`

export default function ImportPage() {
  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center gap-2 text-sm text-zinc-500">
        <Link href="/dashboard/deals" className="hover:text-zinc-900">Liens</Link>
        <span>/</span>
        <span className="text-zinc-900 font-medium">Import</span>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-900">Import Liens</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Bulk-import lien certificates from CSV, XLS, or XLSX. Each row creates one lien.
          ACTIVE rows generate deadlines automatically; LEAD rows do not.
        </p>
      </div>

      {/* Template download */}
      <div className="bg-white rounded-xl border border-zinc-200 p-5 mb-6">
        <h2 className="text-sm font-semibold text-zinc-900 mb-2">Step 1 — Download the template</h2>
        <p className="text-sm text-zinc-500 mb-3">
          The <code className="text-xs bg-zinc-100 px-1 rounded">status</code> column is optional —
          if omitted, rows with cert data import as <strong>ACTIVE</strong>; rows without import as <strong>LEAD</strong>.
          State must be a 2-letter code (e.g. FL). Interest rate is a percentage (e.g. 18 for 18%). Issue date is YYYY-MM-DD.
        </p>
        <div className="bg-zinc-50 rounded-lg border border-zinc-200 p-3 mb-3 overflow-x-auto">
          <code className="text-xs text-zinc-600 whitespace-nowrap">
            status,state,county,apn,certificate_number,face_amount,interest_rate,issue_date,address,notes
          </code>
          <br />
          <code className="text-xs text-zinc-400 whitespace-nowrap">
            ACTIVE,FL,Miami-Dade,12-3456-789-0001,2024-0001,5000,18,2024-06-15,123 Main St,
          </code>
          <br />
          <code className="text-xs text-zinc-400 whitespace-nowrap">
            LEAD,FL,Miami-Dade,12-3456-789-0002,,,,,456 Oak Ave,Pre-auction lead
          </code>
        </div>
        <div className="mb-3 text-xs text-zinc-500">
          <strong>Valid status values:</strong> LEAD · ACTIVE · NOT_WON · REDEEMED · FORECLOSURE_INITIATED · DEEDED
        </div>
        <a
          href={TEMPLATE_DATA_URL}
          download="metis-lien-import-template.csv"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-700 border border-zinc-300 rounded-lg hover:bg-zinc-50 transition-colors"
        >
          ↓ Download Template CSV
        </a>
      </div>

      {/* Upload + preview */}
      <ImportForm />
    </div>
  )
}
