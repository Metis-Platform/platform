import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { syncUserToDatabase } from '@/lib/sync-user'
import { db } from '@/lib/db'
import { ContactDetailClient } from './client'
import type { ContactType, ContactPipelineStage } from '@/app/generated/prisma'

const TYPE_LABELS: Record<ContactType, string> = {
  OWNER: 'Owner', ATTORNEY: 'Attorney', AGENT: 'Agent', LENDER: 'Lender',
  BUYER: 'Buyer', SELLER: 'Seller', AGENCY: 'Agency',
  CONTRACTOR: 'Contractor', TENANT: 'Tenant', VENDOR: 'Vendor', OTHER: 'Other',
}

const STAGE_LABELS: Record<ContactPipelineStage, string> = {
  LEAD: 'Lead', CONTACTED: 'Contacted', NEGOTIATING: 'Negotiating',
  UNDER_CONTRACT: 'Under Contract', CLOSED: 'Closed', DEAD: 'Dead',
}

const STAGE_COLORS: Record<ContactPipelineStage, string> = {
  LEAD: 'bg-zinc-100 text-zinc-600',
  CONTACTED: 'bg-blue-50 text-blue-700',
  NEGOTIATING: 'bg-amber-50 text-amber-700',
  UNDER_CONTRACT: 'bg-purple-50 text-purple-700',
  CLOSED: 'bg-emerald-50 text-emerald-700',
  DEAD: 'bg-red-50 text-red-600',
}

const STRATEGY_LABELS: Record<string, string> = {
  TAX_LIEN: 'Tax Lien', TAX_DEED: 'Tax Deed', FORECLOSURE: 'Foreclosure',
  WHOLESALE: 'Wholesale', FIX_FLIP: 'Fix & Flip', BUY_HOLD: 'Buy & Hold',
  LAND: 'Land', MULTIFAMILY: 'Multifamily', NOTE: 'Note',
}

export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) redirect('/sign-in')
  const synced = await syncUserToDatabase()
  if (!synced) redirect('/onboarding')
  const { tenant } = synced
  const { id } = await params

  const contact = await db.contact.findUnique({
    where: { id, tenantId: tenant.id },
    include: {
      activities: { orderBy: { occurredAt: 'desc' } },
      deals: {
        select: {
          id: true,
          strategyType: true,
          status: true,
          property: { select: { address: true, city: true, state: true } },
        },
      },
      buyerProfile: true,
    },
  })

  if (!contact) notFound()

  const name = [contact.firstName, contact.lastName].filter(Boolean).join(' ') || contact.company || 'Contact'

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <Link href="/dashboard/contacts" className="text-xs text-zinc-400 hover:text-zinc-600 mb-1 block">
            ← Contacts
          </Link>
          <h1 className="text-2xl font-semibold text-zinc-900">{name}</h1>
          {contact.company && (contact.firstName || contact.lastName) && (
            <p className="text-sm text-zinc-500">{contact.company}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${STAGE_COLORS[contact.pipelineStage]}`}>
            {STAGE_LABELS[contact.pipelineStage]}
          </span>
          <span className="text-xs text-zinc-400 border border-zinc-200 px-2 py-1 rounded-full">
            {TYPE_LABELS[contact.type]}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left: contact info + deals */}
        <div className="col-span-1 space-y-4">
          <div className="bg-white border border-zinc-200 rounded-xl p-4 space-y-3">
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Contact Info</h2>
            {contact.email && (
              <div>
                <div className="text-xs text-zinc-400">Email</div>
                <a href={`mailto:${contact.email}`} className="text-sm text-blue-600 hover:underline">{contact.email}</a>
              </div>
            )}
            {contact.phone && (
              <div>
                <div className="text-xs text-zinc-400">Phone</div>
                <a href={`tel:${contact.phone}`} className="text-sm text-zinc-700">{contact.phone}</a>
              </div>
            )}
            {(contact.address || contact.city) && (
              <div>
                <div className="text-xs text-zinc-400">Address</div>
                <div className="text-sm text-zinc-700">
                  {contact.address && <div>{contact.address}</div>}
                  {(contact.city || contact.state) && (
                    <div>{[contact.city, contact.state, contact.zip].filter(Boolean).join(', ')}</div>
                  )}
                </div>
              </div>
            )}
            {contact.notes && (
              <div>
                <div className="text-xs text-zinc-400">Notes</div>
                <p className="text-sm text-zinc-600 whitespace-pre-wrap">{contact.notes}</p>
              </div>
            )}
            <div className="pt-1 border-t border-zinc-100">
              <Link
                href={`/dashboard/contacts/${contact.id}/edit`}
                className="text-xs text-zinc-500 hover:text-zinc-900"
              >
                Edit contact
              </Link>
            </div>
          </div>

          {/* Linked deals */}
          {contact.deals.length > 0 && (
            <div className="bg-white border border-zinc-200 rounded-xl p-4">
              <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">
                Linked Deals ({contact.deals.length})
              </h2>
              <div className="space-y-2">
                {contact.deals.map(d => (
                  <Link
                    key={d.id}
                    href={`/dashboard/deals/${d.id}`}
                    className="block text-sm hover:text-blue-600"
                  >
                    <div className="font-medium text-zinc-800">{d.property.address}</div>
                    <div className="text-xs text-zinc-400">
                      {STRATEGY_LABELS[d.strategyType] ?? d.strategyType} · {d.status}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: activity timeline */}
        <div className="col-span-2">
          <ContactDetailClient contactId={contact.id} activities={contact.activities} />
        </div>
      </div>
    </div>
  )
}
