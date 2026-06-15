'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { createContact } from '@/lib/actions/contact'
import type { ContactFormState } from '@/lib/actions/contact'

const TYPE_OPTIONS = [
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

const STAGE_OPTIONS = [
  { value: 'LEAD', label: 'Lead' },
  { value: 'CONTACTED', label: 'Contacted' },
  { value: 'NEGOTIATING', label: 'Negotiating' },
  { value: 'UNDER_CONTRACT', label: 'Under Contract' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'DEAD', label: 'Dead' },
]

const initialState: ContactFormState = {}

export function NewContactForm() {
  const [state, formAction, pending] = useActionState(createContact, initialState)

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
            className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
            placeholder="Jane"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1">Last Name</label>
          <input
            name="lastName"
            className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
            placeholder="Smith"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-700 mb-1">Company</label>
        <input
          name="company"
          className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
          placeholder="Acme Holdings LLC"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1">Type</label>
          <select
            name="type"
            defaultValue="OTHER"
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
            defaultValue="LEAD"
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
            className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
            placeholder="jane@example.com"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1">Phone</label>
          <input
            name="phone"
            type="tel"
            className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
            placeholder="(555) 555-1234"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-700 mb-1">Address</label>
        <input
          name="address"
          className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
          placeholder="123 Main St"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-1">
          <label className="block text-xs font-medium text-zinc-700 mb-1">City</label>
          <input
            name="city"
            className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1">State</label>
          <input
            name="state"
            maxLength={2}
            className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
            placeholder="FL"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1">ZIP</label>
          <input
            name="zip"
            className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-700 mb-1">Notes</label>
        <textarea
          name="notes"
          rows={3}
          className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 resize-none"
          placeholder="Background, relationship notes…"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 text-sm font-medium bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 disabled:opacity-50 transition-colors"
        >
          {pending ? 'Saving…' : 'Create Contact'}
        </button>
        <Link
          href="/dashboard/contacts"
          className="px-4 py-2 text-sm font-medium text-zinc-600 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors"
        >
          Cancel
        </Link>
      </div>
    </form>
  )
}
