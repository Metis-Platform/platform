'use client'

import { useState, useActionState, useOptimistic, useTransition } from 'react'
import { logActivity } from '@/lib/actions/contact'
import type { ContactFormState } from '@/lib/actions/contact'
import type { ContactActivity, ContactActivityType } from '@/app/generated/prisma'

const ACTIVITY_TYPE_OPTIONS: { value: ContactActivityType; label: string }[] = [
  { value: 'NOTE', label: 'Note' },
  { value: 'CALL', label: 'Call' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'TEXT', label: 'Text' },
  { value: 'MEETING', label: 'Meeting' },
  { value: 'OFFER_SENT', label: 'Offer Sent' },
  { value: 'CONTRACT_SENT', label: 'Contract Sent' },
  { value: 'OTHER', label: 'Other' },
]

const TYPE_ICONS: Record<ContactActivityType, string> = {
  NOTE: '📝',
  CALL: '📞',
  EMAIL: '✉️',
  TEXT: '💬',
  MEETING: '🤝',
  OFFER_SENT: '📄',
  CONTRACT_SENT: '✍️',
  OTHER: '·',
}

const initialState: ContactFormState = {}

export function ContactDetailClient({
  contactId,
  activities,
}: {
  contactId: string
  activities: ContactActivity[]
}) {
  const [showLog, setShowLog] = useState(false)
  const boundLogActivity = logActivity.bind(null, contactId)
  const [state, formAction, pending] = useActionState(boundLogActivity, initialState)
  const [, startTransition] = useTransition()
  const [optimisticActivities, addOptimistic] = useOptimistic(
    activities,
    (current, newActivity: ContactActivity) => [newActivity, ...current],
  )

  function handleSubmit(formData: FormData) {
    const type = formData.get('type') as ContactActivityType
    const notes = (formData.get('notes') as string)?.trim() || null
    const occurredAt = (formData.get('occurredAt') as string) || new Date().toISOString()
    startTransition(() => {
      addOptimistic({
        id: crypto.randomUUID(),
        contactId,
        tenantId: '',
        type,
        notes,
        occurredAt: new Date(occurredAt),
        createdAt: new Date(),
      })
    })
    setShowLog(false)
    formAction(formData)
  }

  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">
          Outreach Log ({optimisticActivities.length})
        </h2>
        <button
          onClick={() => setShowLog(v => !v)}
          className="text-xs font-medium text-zinc-600 border border-zinc-200 px-2.5 py-1 rounded-lg hover:bg-zinc-50 transition-colors"
        >
          + Log Activity
        </button>
      </div>

      {/* Log form */}
      {showLog && (
        <form action={handleSubmit} className="mb-5 p-3 bg-zinc-50 rounded-lg border border-zinc-200 space-y-3">
          {state.error && (
            <div className="text-xs text-red-600">{state.error}</div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Type</label>
              <select
                name="type"
                defaultValue="NOTE"
                className="w-full px-2.5 py-1.5 text-sm border border-zinc-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
              >
                {ACTIVITY_TYPE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Date</label>
              <input
                name="occurredAt"
                type="date"
                defaultValue={new Date().toISOString().split('T')[0]}
                className="w-full px-2.5 py-1.5 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Notes</label>
            <textarea
              name="notes"
              rows={2}
              className="w-full px-2.5 py-1.5 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 resize-none"
              placeholder="What happened? What was discussed?"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="px-3 py-1.5 text-xs font-medium bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 disabled:opacity-50 transition-colors"
            >
              {pending ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => setShowLog(false)}
              className="px-3 py-1.5 text-xs font-medium text-zinc-500 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Timeline */}
      {optimisticActivities.length === 0 ? (
        <div className="text-center py-8 text-zinc-400">
          <p className="text-sm">No activity logged yet.</p>
          <p className="text-xs mt-1">Log calls, emails, meetings, and offers here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {optimisticActivities.map(a => (
            <div key={a.id} className="flex gap-3">
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-zinc-100 flex items-center justify-center text-sm">
                {TYPE_ICONS[a.type]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-zinc-700">
                    {a.type.replace('_', ' ')}
                  </span>
                  <span className="text-xs text-zinc-400">
                    {new Date(a.occurredAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
                {a.notes && (
                  <p className="text-sm text-zinc-600 mt-0.5 whitespace-pre-wrap">{a.notes}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
