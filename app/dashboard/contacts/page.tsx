import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { syncUserToDatabase } from '@/lib/sync-user'
import { db } from '@/lib/db'
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

const CONTACT_TYPES: ContactType[] = ['OWNER','ATTORNEY','AGENT','LENDER','BUYER','SELLER','AGENCY','CONTRACTOR','TENANT','VENDOR','OTHER']
const PIPELINE_STAGES: ContactPipelineStage[] = ['LEAD','CONTACTED','NEGOTIATING','UNDER_CONTRACT','CLOSED','DEAD']

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; stage?: string; q?: string }>
}) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) redirect('/sign-in')
  const synced = await syncUserToDatabase()
  if (!synced) redirect('/onboarding')
  const { tenant } = synced

  const { type: typeParam, stage: stageParam, q } = await searchParams
  const typeFilter = typeParam && CONTACT_TYPES.includes(typeParam as ContactType) ? (typeParam as ContactType) : null
  const stageFilter = stageParam && PIPELINE_STAGES.includes(stageParam as ContactPipelineStage) ? (stageParam as ContactPipelineStage) : null

  const contacts = await db.contact.findMany({
    where: {
      tenantId: tenant.id,
      ...(typeFilter ? { type: typeFilter } : {}),
      ...(stageFilter ? { pipelineStage: stageFilter } : {}),
      ...(q
        ? {
            OR: [
              { firstName: { contains: q, mode: 'insensitive' } },
              { lastName: { contains: q, mode: 'insensitive' } },
              { company: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    include: {
      _count: { select: { deals: true, activities: true } },
      activities: { orderBy: { occurredAt: 'desc' }, take: 1 },
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { company: 'asc' }],
  })

  function buildUrl(params: Record<string, string | null>) {
    const sp = new URLSearchParams()
    const merged = { type: typeParam ?? null, stage: stageParam ?? null, q: q ?? null, ...params }
    for (const [k, v] of Object.entries(merged)) {
      if (v) sp.set(k, v)
    }
    const s = sp.toString()
    return `/dashboard/contacts${s ? `?${s}` : ''}`
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Contacts</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Sellers, contractors, tenants, buyers, and other contacts across all deals.</p>
        </div>
        <Link
          href="/dashboard/contacts/new"
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 transition-colors"
        >
          + Add Contact
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-5">
        <form method="GET" action="/dashboard/contacts" className="flex-1 min-w-48">
          <input
            name="q"
            defaultValue={q ?? ''}
            placeholder="Search name, company, email…"
            className="w-full px-3 py-1.5 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
          />
          {typeParam && <input type="hidden" name="type" value={typeParam} />}
          {stageParam && <input type="hidden" name="stage" value={stageParam} />}
        </form>

        <div className="flex flex-wrap gap-1">
          <Link
            href={buildUrl({ type: null })}
            className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${!typeFilter ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400'}`}
          >
            All types
          </Link>
          {CONTACT_TYPES.map(t => (
            <Link
              key={t}
              href={buildUrl({ type: typeFilter === t ? null : t })}
              className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${typeFilter === t ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400'}`}
            >
              {TYPE_LABELS[t]}
            </Link>
          ))}
        </div>

        <div className="flex flex-wrap gap-1">
          <Link
            href={buildUrl({ stage: null })}
            className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${!stageFilter ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400'}`}
          >
            All stages
          </Link>
          {PIPELINE_STAGES.map(s => (
            <Link
              key={s}
              href={buildUrl({ stage: stageFilter === s ? null : s })}
              className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${stageFilter === s ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400'}`}
            >
              {STAGE_LABELS[s]}
            </Link>
          ))}
        </div>
      </div>

      {contacts.length === 0 ? (
        <div className="text-center py-16 text-zinc-400">
          <p className="text-base font-medium mb-1">No contacts yet</p>
          <p className="text-sm">Add sellers, buyers, contractors, tenants, and other contacts here.</p>
        </div>
      ) : (
        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50">
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Name / Company</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Type</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Stage</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Contact</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Last Activity</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Deals</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {contacts.map(c => {
                const name = [c.firstName, c.lastName].filter(Boolean).join(' ') || c.company || '—'
                const lastActivity = c.activities[0]

                return (
                  <tr key={c.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/contacts/${c.id}`} className="font-medium text-zinc-900 hover:text-blue-600">
                        {name}
                      </Link>
                      {c.company && (c.firstName || c.lastName) && (
                        <div className="text-xs text-zinc-400">{c.company}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-zinc-500">{TYPE_LABELS[c.type]}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STAGE_COLORS[c.pipelineStage]}`}>
                        {STAGE_LABELS[c.pipelineStage]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 text-xs">
                      <div>{c.email ?? '—'}</div>
                      {c.phone && <div className="text-zinc-400">{c.phone}</div>}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs">
                      {lastActivity ? (
                        <span title={lastActivity.notes ?? undefined}>
                          {lastActivity.type.replace('_', ' ')} · {new Date(lastActivity.occurredAt).toLocaleDateString()}
                        </span>
                      ) : (
                        <span className="text-zinc-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs">
                      {c._count.deals > 0 ? `${c._count.deals} deal${c._count.deals !== 1 ? 's' : ''}` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
