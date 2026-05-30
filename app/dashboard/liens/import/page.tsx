import Link from 'next/link'
import ImportForm from './ImportForm'

export default function ImportPage() {
  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center gap-2 text-sm text-zinc-500">
        <Link href="/dashboard/liens" className="hover:text-zinc-900">Liens</Link>
        <span>/</span>
        <span className="text-zinc-900 font-medium">Import</span>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-900">Import Liens from CSV</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Bulk-import active lien certificates. Each row creates one lien with deadlines generated automatically.
        </p>
      </div>

      {/* Template download */}
      <div className="bg-white rounded-xl border border-zinc-200 p-5 mb-6">
        <h2 className="text-sm font-semibold text-zinc-900 mb-2">Step 1 — Download the template</h2>
        <p className="text-sm text-zinc-500 mb-3">
          Fill in one row per lien. State must be a 2-letter code (e.g. FL). County must match exactly.
          Interest rate is a percentage (e.g. 18 for 18%). Issue date is YYYY-MM-DD.
        </p>
        <div className="bg-zinc-50 rounded-lg border border-zinc-200 p-3 mb-4 overflow-x-auto">
          <code className="text-xs text-zinc-600 whitespace-nowrap">
            state,county,apn,certificate_number,face_amount,interest_rate,issue_date,address,notes
          </code>
          <br />
          <code className="text-xs text-zinc-400 whitespace-nowrap">
            FL,Miami-Dade,12-3456-789-0001,2024-0001,5000,18,2024-06-15,123 Main St Miami FL 33101,
          </code>
        </div>
        <a
          href="data:text/csv;charset=utf-8,state%2Ccounty%2Capn%2Ccertificate_number%2Cface_amount%2Cinterest_rate%2Cissue_date%2Caddress%2Cnotes%0AFL%2CMiami-Dade%2C12-3456-789-0001%2C2024-0001%2C5000%2C18%2C2024-06-15%2C123%20Main%20St%20Miami%20FL%2033101%2C"
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
