'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { updateContact } from '@/lib/actions/contact'
import type { ContactFormState } from '@/lib/actions/contact'
import type { Contact, ContactType, ContactPipelineStage } from '@/app/generated/prisma'

const TYPE_OPTIONS: { value: ContactType; label: string }[] = [
  { value: 'SELLER', label: 'Seller' },
  { value: 'BUYER', label: 'Buyer' },
  { value: 'CONTRACTOR', label: 'Contractor' },
  { value: 'TENANT', label: 'Tenant' },
  { value: 'OWNER', label: 'Owner' },
  { value: 'ATTORNEY', label: 'Attorney' },
  { value: 'AGENT', label: 'Agent' },
  { value: 'LENDER', label: 'Lender' },
  { value: 'VENDOR', label: 'Vendor' },
  { value: 'AGENCY', label: 'Agency' },
  { value: 'OTHER', label: 'Other' },
]

const STAGE_OPTIONS: { value: ContactPipelineStage; label: string }[] = [
  { value: 'LEAD', label: 'Lead' },
  { value: 'CONTACTED', label: 'Contacted' },
  { value: 'NEGOTIATING', label: 'Negotiating' },
  { value: 'UNDER_CONTRACT', label: 'Under Contract' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'DEAD', label: 'Dead' },
]

const initialState: ContactFormState = {}

export function EditContactForm({ contact }: { contact: Contact }) {
  const boundUpdate = updateContact.bind(null, contact.id)
  const [state, formAction, pending] = useActionState(boundUpdate, initialState)

  return (
    <form action={formAction} className="space-y-5">
      {state.error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{state.error}</div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1">First Name</label>
          <input
            name="firstName"
            defaultValue={contact.firstName ?? ''}
            className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1">Last Name</label>
          <input
            name="lastName"
            defaultValue={contact.lastName ?? ''}
            className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-700 mb-1">Company</label>
        <input
          name="company"
          defaultValue={contact.company ?? ''}
          className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1">Type</label>
          <select
            name="type"
            defaultValue={contact.type}
            className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 bg-white"
          >
            {TYPE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1">Pipeline Stage</label>
          <select
            name="pipelineStage"
            defaultValue={contact.pipelineStage}
            className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 bg-white"
          >
            {STAGE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1">Email</label>
          <input
            name="email"
            type="email"
            defaultValue={contact.email ?? ''}
            className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1">Phone</label>
          <input
            name="phone"
            type="tel"
            defaultValue={contact.phone ?? ''}
            className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-700 mb-1">Address</label>
        <input
          name="address"
          defaultValue={contact.address ?? ''}
          className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-1">
          <label className="block text-xs font-medium text-zinc-700 mb-1">City</label>
          <input
            name="city"
            defaultValue={contact.city ?? ''}
            className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1">State</label>
          <input
            name="state"
            maxLength={2}
            defaultValue={contact.state ?? ''}
            className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1">ZIP</label>
          <input
            name="zip"
            defaultValue={contact.zip ?? ''}
            className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-700 mb-1">Notes</label>
        <textarea
          name="notes"
          rows={3}
          defaultValue={contact.notes ?? ''}
          className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 resize-none"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 text-sm font-medium bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 disabled:opacity-50 transition-colors"
        >
          {pending ? 'Saving…' : 'Save Changes'}
        </button>
        <Link
          href={`/dashboard/contacts/${contact.id}`}
          className="px-4 py-2 text-sm font-medium text-zinc-600 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors"
        >
          Cancel
        </Link>
      </div>
    </form>
  )
}
