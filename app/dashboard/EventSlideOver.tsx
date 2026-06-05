'use client'

import { useState, useTransition, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { updateEvent } from '@/lib/actions/events'

// ─── Types ────────────────────────────────────────────────────────────────────

export type EventForEdit = {
  id: string
  label: string
  eventType: string
  dueDate: string          // ISO string
  completedDate: string | null
  status: string
  notes: string | null
  apn: string
  address: string | null
  dealId: string
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: 'PENDING',   label: 'Pending',   cls: 'bg-blue-100 text-blue-700 border-blue-300' },
  { value: 'COMPLETED', label: 'Completed', cls: 'bg-green-100 text-green-700 border-green-300' },
  { value: 'OVERDUE',   label: 'Overdue',   cls: 'bg-red-100 text-red-700 border-red-300' },
  { value: 'SKIPPED',   label: 'Skipped',   cls: 'bg-zinc-100 text-zinc-500 border-zinc-300' },
]

const EVENT_TYPE_LABELS: Record<string, string> = {
  REDEMPTION_DEADLINE:  'Redemption Deadline',
  NOTICE_MAIL_BY:       'Notice Mail By',
  PUBLICATION_START:    'Publication Start',
  FORECLOSURE_ELIGIBLE: 'Foreclosure Eligible',
  FORECLOSURE_DEADLINE: 'Foreclosure Deadline',
  AUCTION_DATE:         'Auction Date',
  DEED_ISSUED:          'Deed Issued',
  CUSTOM:               'Custom',
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function EventSlideOver({
  event,
  onClose,
}: {
  event: EventForEdit | null
  onClose: () => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [status,        setStatus]        = useState('')
  const [dueDate,       setDueDate]       = useState('')
  const [completedDate, setCompletedDate] = useState('')
  const [notes,         setNotes]         = useState('')

  // Sync local state when event changes
  useEffect(() => {
    if (!event) return
    setStatus(event.status)
    setDueDate(event.dueDate.slice(0, 10))
    setCompletedDate(event.completedDate?.slice(0, 10) ?? '')
    setNotes(event.notes ?? '')
  }, [event])

  // Close on Escape
  const handleEscape = useCallback(
    (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() },
    [onClose]
  )
  useEffect(() => {
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [handleEscape])

  function handleSave() {
    if (!event) return
    startTransition(async () => {
      await updateEvent(event.id, {
        status,
        dueDate,
        notes: notes || null,
        completedDate:
          status === 'COMPLETED' && completedDate ? completedDate : null,
      })
      router.refresh()
      onClose()
    })
  }

  if (!event) return null

  const typeLabel = EVENT_TYPE_LABELS[event.eventType] ?? event.eventType

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[1px]"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl">

        {/* Header */}
        <div className="flex items-start justify-between border-b border-zinc-200 px-6 py-4">
          <div className="min-w-0 pr-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
              {typeLabel}
            </p>
            <h2 className="mt-0.5 text-base font-semibold text-zinc-900 leading-snug">
              {event.label}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="mt-0.5 shrink-0 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Deal context strip */}
        <div className="border-b border-zinc-100 bg-zinc-50 px-6 py-2.5">
          <p className="text-xs text-zinc-500">
            Deal:{' '}
            <Link
              href={`/dashboard/deals/${event.dealId}`}
              className="font-mono font-medium text-blue-600 hover:underline"
              onClick={onClose}
            >
              {event.apn}
            </Link>
            {event.address && (
              <span className="ml-2 text-zinc-400">{event.address}</span>
            )}
          </p>
        </div>

        {/* Scrollable form body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">

          {/* Status selector */}
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700">
              Status
            </label>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setStatus(s.value)}
                  className={`rounded-full border-2 px-3 py-1 text-sm font-medium transition-all ${
                    status === s.value
                      ? `${s.cls} scale-105 shadow-sm`
                      : 'border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Due date */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700">
              Due Date
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
            />
            <p className="mt-1 text-xs text-zinc-400">
              Overrides the calculated deadline. Change only if a court grants an extension or error needs correcting.
            </p>
          </div>

          {/* Completed date — shown only when status is COMPLETED */}
          {status === 'COMPLETED' && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700">
                Date Completed
              </label>
              <input
                type="date"
                value={completedDate}
                onChange={(e) => setCompletedDate(e.target.value)}
                className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
              />
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={5}
              placeholder="e.g. Mailed certified notice to 123 Main St — USPS tracking #9400111899223765490482"
              className="block w-full resize-none rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 border-t border-zinc-200 px-6 py-4">
          <button
            onClick={handleSave}
            disabled={isPending}
            className="flex-1 rounded-lg bg-zinc-900 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-40"
          >
            {isPending ? 'Saving…' : 'Save Changes'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm text-zinc-500 hover:text-zinc-900"
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  )
}
