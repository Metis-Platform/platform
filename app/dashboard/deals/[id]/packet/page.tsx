import { auth } from '@clerk/nextjs/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/db'
import { hasTier } from '@/lib/entitlements'

export const metadata = { title: 'Assignment Packet — Metis' }

export default async function AssignmentPacketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { userId, orgId } = await auth()
  if (!userId || !orgId) redirect('/sign-in')

  const tenant = await db.tenant.findUnique({ where: { clerkOrgId: orgId } })
  if (!tenant) redirect('/sign-in')

  if (!await hasTier(tenant.id, 'WHOLESALE', 'PREMIUM')) {
    redirect(`/dashboard/deals/${id}`)
  }

  const deal = await db.deal.findUnique({
    where: { id, tenantId: tenant.id },
    include: {
      property: { include: { jurisdiction: true } },
      wholesale: { include: { buyerContact: { select: { firstName: true, lastName: true, company: true, email: true, phone: true } } } },
    },
  })
  if (!deal || deal.strategyType !== 'WHOLESALE') notFound()

  const { property, wholesale } = deal
  const jur = property.jurisdiction
  const buyerName = wholesale?.buyerContact
    ? [wholesale.buyerContact.firstName, wholesale.buyerContact.lastName].filter(Boolean).join(' ') || wholesale.buyerContact.company || 'Buyer'
    : wholesale?.buyerName || null
  const buyerEmail = wholesale?.buyerContact?.email ?? wholesale?.buyerEmail ?? null
  const buyerPhone = wholesale?.buyerContact?.phone ?? wholesale?.buyerPhone ?? null

  const address = [property.address, property.city, property.state, property.zip].filter(Boolean).join(', ')
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 print:px-0 print:py-0">
      {/* Print controls — hidden when printing */}
      <div className="flex items-center gap-4 mb-6 print:hidden">
        <Link href={`/dashboard/deals/${id}`} className="text-sm text-zinc-500 hover:text-zinc-900">← Back to Deal</Link>
        <button onClick={() => window.print()}
          className="ml-auto px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition-colors">
          Print / Save PDF
        </button>
      </div>

      {/* Packet header */}
      <div className="border-b-2 border-zinc-900 pb-4 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">Assignment Packet</h1>
            <p className="text-sm text-zinc-500 mt-1">Prepared by Metis Platform · {today}</p>
          </div>
          <div className="text-right text-sm text-zinc-500">
            <div className="font-semibold text-zinc-900">APN: {property.apn}</div>
            {jur && <div>{jur.county} County, {jur.state}</div>}
          </div>
        </div>
      </div>

      {/* Property sheet */}
      <section className="mb-8">
        <h2 className="text-base font-bold text-zinc-900 mb-3 border-b border-zinc-200 pb-1">Property Details</h2>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <Field label="APN" value={property.apn} />
          <Field label="Address" value={address || '—'} />
          {property.acres && <Field label="Acreage" value={`${Number(property.acres).toFixed(2)} ac`} />}
          {property.assessedValue && (
            <Field label="Assessed Value" value={`$${Number(property.assessedValue).toLocaleString()}`} />
          )}
          {jur && <Field label="Jurisdiction" value={`${jur.county} County, ${jur.state}`} />}
        </dl>
      </section>

      {/* Deal terms */}
      <section className="mb-8">
        <h2 className="text-base font-bold text-zinc-900 mb-3 border-b border-zinc-200 pb-1">Deal Terms</h2>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
          {wholesale?.contractPrice && (
            <Field label="Contract Price" value={`$${Number(wholesale.contractPrice).toLocaleString()}`} />
          )}
          {wholesale?.earnestMoney && (
            <Field label="Earnest Money" value={`$${Number(wholesale.earnestMoney).toLocaleString()}`} />
          )}
          {wholesale?.assignmentFee && (
            <Field label="Assignment Fee" value={`$${Number(wholesale.assignmentFee).toLocaleString()}`} />
          )}
          {wholesale?.inspectionDeadline && (
            <Field label="Inspection Deadline" value={new Date(wholesale.inspectionDeadline).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} />
          )}
          {wholesale?.closingDeadline && (
            <Field label="Closing Deadline" value={new Date(wholesale.closingDeadline).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} />
          )}
          {wholesale?.contractDate && (
            <Field label="Contract Date" value={new Date(wholesale.contractDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} />
          )}
        </dl>
      </section>

      {/* Buyer info */}
      {(buyerName || buyerEmail || buyerPhone) && (
        <section className="mb-8">
          <h2 className="text-base font-bold text-zinc-900 mb-3 border-b border-zinc-200 pb-1">Buyer Information</h2>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            {buyerName && <Field label="Buyer" value={buyerName} />}
            {buyerEmail && <Field label="Email" value={buyerEmail} />}
            {buyerPhone && <Field label="Phone" value={buyerPhone} />}
          </dl>
        </section>
      )}

      {/* Marketing notes */}
      {wholesale?.marketingNotes && (
        <section className="mb-8">
          <h2 className="text-base font-bold text-zinc-900 mb-3 border-b border-zinc-200 pb-1">Notes</h2>
          <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">{wholesale.marketingNotes}</p>
        </section>
      )}

      {/* Assignment agreement placeholder */}
      <section className="mt-12 pt-8 border-t-2 border-zinc-200">
        <h2 className="text-base font-bold text-zinc-900 mb-6">Assignment of Contract</h2>
        <p className="text-sm text-zinc-600 mb-8">
          For valuable consideration, Assignor hereby assigns all rights, title, and interest in and to the Purchase
          and Sale Agreement dated{' '}
          {wholesale?.contractDate
            ? new Date(wholesale.contractDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
            : '_______________'}{' '}
          for the property at {address || property.apn} to Assignee, subject to the terms and conditions therein.
        </p>

        <div className="grid grid-cols-2 gap-16 mt-12">
          <SignatureLine label="Assignor (Seller)" />
          <SignatureLine label="Assignee (Buyer)" />
        </div>
      </section>

      <p className="mt-8 text-xs text-zinc-400 print:mt-4">
        Generated by Metis Platform · metisplatforms.com · {today}
      </p>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-zinc-500 mb-0.5">{label}</dt>
      <dd className="text-zinc-900">{value}</dd>
    </div>
  )
}

function SignatureLine({ label }: { label: string }) {
  return (
    <div>
      <div className="border-b border-zinc-400 mb-1 h-8" />
      <p className="text-xs text-zinc-500">{label}</p>
      <div className="mt-3 border-b border-zinc-400 mb-1 h-8" />
      <p className="text-xs text-zinc-500">Date</p>
    </div>
  )
}
