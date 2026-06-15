import Link from 'next/link'
import { redirect } from 'next/navigation'
import { isSuperAdmin } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import ParcelResearchForm from './ParcelResearchForm'

type Props = {
  params: Promise<{ id: string }>
}

export default async function ParcelResearchDetailPage({ params }: Props) {
  if (!(await isSuperAdmin())) redirect('/')
  const { id } = await params

  const request = await db.parcelResearchRequest.findUnique({
    where: { id },
    include: {
      tenant: { select: { name: true } },
      deal: {
        select: {
          id: true,
          strategyType: true,
          property: {
            select: {
              apn: true,
              address: true,
              city: true,
              state: true,
              zip: true,
              jurisdiction: { select: { county: true, state: true } },
            },
          },
        },
      },
    },
  })
  if (!request) redirect('/admin/parcel-research')

  const cacheRows = await db.parcelDataCache.findMany({
    where: {
      tenantId: request.tenantId,
      apnNormalized: request.apnNormalized,
      fipsCounty: request.fipsCounty,
      source: 'manual',
    },
    orderBy: { field: 'asc' },
  })

  const cacheValues = Object.fromEntries(cacheRows.map(row => [row.field, row.normalized ?? row.valueJson]))

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 text-sm text-zinc-500">
            <Link href="/admin/parcel-research" className="hover:text-zinc-900">Parcel Research</Link>
            <span className="mx-2">/</span>
            <span className="font-mono">{request.deal.property.apn}</span>
          </div>
          <h1 className="text-xl font-semibold text-zinc-900">Research Request</h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            {request.deal.property.jurisdiction.county}, {request.deal.property.jurisdiction.state} · {request.tenant.name}
          </p>
        </div>
        <Link
          href={`/dashboard/deals/${request.deal.id}`}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Open Deal
        </Link>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Info label="Status" value={labelize(request.status)} />
        <Info label="Priority" value={labelize(request.priority)} />
        <Info label="Requested" value={formatDate(request.requestedAt)} />
      </div>

      <div className="mb-6 rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-zinc-900">Parcel</h2>
        <dl className="grid gap-3 text-sm md:grid-cols-2">
          <Info label="APN" value={request.deal.property.apn} />
          <Info label="Normalized APN" value={request.apnNormalized} />
          <Info label="FIPS county" value={request.fipsCounty} />
          <Info label="Address" value={formatAddress(request.deal.property)} />
        </dl>
      </div>

      <ParcelResearchForm
        requestId={request.id}
        status={request.status}
        notes={request.notes ?? ''}
        cacheValues={cacheValues}
      />
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase text-zinc-500">{label}</dt>
      <dd className="mt-1 text-sm text-zinc-900">{value || 'Unknown'}</dd>
    </div>
  )
}

function labelize(value: string) {
  return value.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, char => char.toUpperCase())
}

function formatDate(value: Date) {
  return value.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatAddress(property: {
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
}) {
  return [property.address, property.city, property.state, property.zip].filter(Boolean).join(', ')
}
