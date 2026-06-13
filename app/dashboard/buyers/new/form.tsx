'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { createBuyer, type BuyerFormState } from '@/lib/actions/buyer'

const initial: BuyerFormState = {}

export default function NewBuyerForm() {
  const [state, action, pending] = useActionState(createBuyer, initial)

  return (
    <form action={action} className="space-y-6">
      {state.error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{state.error}</div>
      )}

      <section>
        <h2 className="text-sm font-semibold text-zinc-700 mb-3">Contact Info</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">First Name</label>
            <input name="firstName" type="text" className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Last Name</label>
            <input name="lastName" type="text" className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" />
          </div>
        </div>
        <div className="mt-4">
          <label className="block text-xs font-medium text-zinc-600 mb-1">Company</label>
          <input name="company" type="text" className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" />
        </div>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Email</label>
            <input name="email" type="email" className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Phone</label>
            <input name="phone" type="tel" className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" />
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-zinc-700 mb-3">Buy-Box Criteria</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Min Price ($)</label>
            <input name="priceMin" type="number" min="0" step="1000" placeholder="0" className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Max Price ($)</label>
            <input name="priceMax" type="number" min="0" step="1000" placeholder="No limit" className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Max Assignment Fee ($)</label>
            <input name="assignmentFeeMax" type="number" min="0" step="500" placeholder="No limit" className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Preferred States</label>
            <input name="preferredStates" type="text" placeholder="FL, TX, GA (comma-separated)" className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" />
            <p className="text-xs text-zinc-400 mt-1">Leave blank for any state</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Property Types</label>
            <input name="preferredPropTypes" type="text" placeholder="SFR, MFR, LAND (comma-separated)" className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" />
            <p className="text-xs text-zinc-400 mt-1">Leave blank for any type</p>
          </div>
        </div>
        <div className="mt-4">
          <label className="block text-xs font-medium text-zinc-600 mb-1">Notes</label>
          <textarea name="profileNotes" rows={3} placeholder="Preferences, communication notes, etc." className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 resize-none" />
        </div>
      </section>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 text-sm font-medium bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 disabled:opacity-50 transition-colors"
        >
          {pending ? 'Saving…' : 'Add Buyer'}
        </button>
        <Link href="/dashboard/buyers" className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors">
          Cancel
        </Link>
      </div>
    </form>
  )
}
