'use client'

import { useState } from 'react'
import EventSlideOver, { type EventForEdit } from '@/app/dashboard/EventSlideOver'

export type DealEvent = {
  id: string
  label: string
  eventType: string
  dueDate: string          // ISO
  completedDate: string | null
  status: string
  notes: string | null
}

const STATUS_DOT: Record<string, string> = {
  COMPLETED: 'bg-green-500',
  OVERDUE:   'bg-red-500',
  SKIPPED:   'bg-zinc-300',
  PENDING:   'bg-zinc-300',  // overridden below for "soon"
}

const STATUS_TEXT: Record<string, string> = {
  COMPLETED: 'text-green-700',
  OVERDUE:   'text-red-600 font-semibold',
  SKIPPED:   'text-zinc-400',
  PENDING:   'text-zinc-500',
}

export default function DealEventsSection({
  dealId,
  apn,
  address,
  events,
}: {
  dealId: string
  apn: string
  address: string | null
  events: DealEvent[]
}) {
  const [selected, setSelected] = useState<EventForEdit | null>(null)

  const now = Date.now()

  return (
    <>
      <div className="bg-white rounded-xl border border-zinc-200 p-6">
        <h2 className="text-sm font-semibold text-zinc-900 mb-4">
          Deadlines{' '}
          <span className="ml-2 text-xs font-normal text-zinc-400">
            {events.length} event{events.length === 1 ? '' : 's'}
          </span>
        </h2>

        {events.length === 0 ? (
          <p className="text-sm text-zinc-400">No deadline events generated yet.</p>
        ) : (
          <ol className="space-y-2">
            {events.map((event) => {
              const days = Math.round(
                (new Date(event.dueDate).getTime() - now) / 86_400_000
              )
              const isDone   = event.status === 'COMPLETED'
              const isOver   = event.status === 'OVERDUE'
              const isSkip   = event.status === 'SKIPPED'
              const soon     = !isDone && !isOver && !isSkip && days >= 0 && days <= 30
              const dot      = isDone ? STATUS_DOT.COMPLETED : isOver ? STATUS_DOT.OVERDUE : isSkip ? STATUS_DOT.SKIPPED : soon ? 'bg-yellow-400' : 'bg-zinc-300'
              const textCls  = isDone ? STATUS_TEXT.COMPLETED : isOver ? STATUS_TEXT.OVERDUE : isSkip ? STATUS_TEXT.SKIPPED : soon ? 'text-yellow-700' : 'text-zinc-500'
              const lbl      = isDone
                ? `Completed${event.completedDate ? ' ' + new Date(event.completedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}`
                : isSkip
                  ? 'Skipped'
                  : isOver
                    ? `${Math.abs(days)}d overdue`
                    : days === 0 ? 'Due today' : `${days}d remaining`

              return (
                <li key={event.id}>
                  <button
                    onClick={() =>
                      setSelected({
                        id:            event.id,
                        label:         event.label,
                        eventType:     event.eventType,
                        dueDate:       event.dueDate,
                        completedDate: event.completedDate,
                        status:        event.status,
                        notes:         event.notes,
                        apn,
                        address,
                        dealId,
                      })
                    }
                    className="flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left hover:bg-zinc-50 transition-colors group"
                  >
                    <div className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dot}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-zinc-800 group-hover:text-zinc-900">
                        {event.label}
                        {event.notes && (
                          <span className="ml-2 text-xs text-zinc-400 italic truncate">
                            · {event.notes}
                          </span>
                        )}
                      </p>
                      <p className={`mt-0.5 text-xs ${textCls}`}>
                        {new Date(event.dueDate).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric',
                        })}{' '}
                        · {lbl}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-zinc-300 group-hover:text-zinc-400 mt-1">
                      Edit →
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        )}
      </div>

      <EventSlideOver event={selected} onClose={() => setSelected(null)} />
    </>
  )
}
