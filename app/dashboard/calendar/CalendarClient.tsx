'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import EventSlideOver, { type EventForEdit } from '@/app/dashboard/EventSlideOver'

type CalEvent = {
  id: string
  dealId: string
  label: string
  dueDate: string
  completedDate: string | null
  status: string
  apn: string
  address: string | null
  eventType: string
  notes: string | null
}

type CalTask = {
  id: string
  dealId: string
  title: string
  dueDate: string
  status: string
  priority: string
  apn: string
}

type MonthSummary = {
  year: number
  month: number
  hasOverdue: boolean
  hasDueSoon: boolean
  hasUpcoming: boolean
}

// Events: colored by urgency status
const EVENT_COLORS: Record<string, string> = {
  PENDING:   'bg-blue-100 text-blue-700',
  OVERDUE:   'bg-red-100 text-red-700',
  COMPLETED: 'bg-green-100 text-green-700',
  SKIPPED:   'bg-zinc-100 text-zinc-500',
}

// Tasks: consistent teal with left-border accent regardless of task status
const TASK_CLASS = 'bg-teal-50 text-teal-700 border-l-2 border-teal-400'

const PRIORITY_DOT: Record<string, string> = {
  URGENT: 'bg-red-500',
  HIGH:   'bg-orange-400',
  MEDIUM: 'bg-yellow-400',
  LOW:    'bg-zinc-300',
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// ---------------------------------------------------------------------------
// Item renderers (shared between month and week view)
// ---------------------------------------------------------------------------

function EventChip({ e, onSelect }: { e: CalEvent; onSelect: (e: CalEvent) => void }) {
  return (
    <button
      onClick={() => onSelect(e)}
      className={`block w-full truncate text-left text-xs px-1.5 py-0.5 rounded ${EVENT_COLORS[e.status] ?? 'bg-zinc-100 text-zinc-600'} hover:opacity-80`}
      title={`${e.label} — APN ${e.apn}`}
    >
      {e.label}
    </button>
  )
}

function TaskChip({ t }: { t: CalTask }) {
  return (
    <Link
      href="/dashboard/tasks"
      className={`flex items-center gap-1 truncate text-xs px-1.5 py-0.5 rounded ${TASK_CLASS} hover:opacity-80`}
      title={`Task: ${t.title} — APN ${t.apn}`}
    >
      <span className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${PRIORITY_DOT[t.priority] ?? 'bg-zinc-300'}`} />
      {t.title}
    </Link>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function CalendarClient({
  year,
  month,
  events,
  tasks,
  monthSummaries,
}: {
  year: number
  month: number
  events: CalEvent[]
  tasks: CalTask[]
  monthSummaries: MonthSummary[]
}) {
  const router = useRouter()

  const [view, setView]             = useState<'month' | 'week'>('month')
  const [pickerOpen, setPickerOpen] = useState(false)
  // pickerWindowStart: index into monthSummaries for the first visible cell (12 shown at a time)
  const [pickerWindowStart, setPickerWindowStart] = useState(0)
  const [selectedEvent, setSelectedEvent] = useState<EventForEdit | null>(null)
  const pickerRef                   = useRef<HTMLDivElement>(null)

  function handleEventSelect(e: CalEvent) {
    setSelectedEvent({
      id:            e.id,
      label:         e.label,
      eventType:     e.eventType,
      dueDate:       e.dueDate,
      completedDate: e.completedDate,
      status:        e.status,
      notes:         e.notes,
      apn:           e.apn,
      address:       e.address,
      dealId:        e.dealId,
    })
  }

  // weekStart: Sunday of the week containing today (if current month) else first Sunday on/before the 1st
  const [weekStart, setWeekStart] = useState<Date>(() => {
    const today = new Date()
    const base  = (today.getFullYear() === year && today.getMonth() === month)
      ? new Date(today)
      : new Date(year, month, 1)
    base.setDate(base.getDate() - base.getDay())
    return base
  })

  // Click-outside to dismiss picker
  useEffect(() => {
    if (!pickerOpen) return
    function onMouseDown(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [pickerOpen])

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  function navigateMonth(delta: number) {
    let m = month + delta, y = year
    if (m < 0)  { m = 11; y -= 1 }
    if (m > 11) { m = 0;  y += 1 }
    router.push(`/dashboard/calendar?month=${m}&year=${y}`)
  }

  function navigateWeek(delta: 1 | -1) {
    const next = new Date(weekStart)
    next.setDate(next.getDate() + delta * 7)
    // Stay in client state if the week's Sunday is still in this month
    if (next.getFullYear() === year && next.getMonth() === month) {
      setWeekStart(next)
    } else {
      router.push(`/dashboard/calendar?month=${next.getMonth()}&year=${next.getFullYear()}`)
    }
  }

  // ---------------------------------------------------------------------------
  // Data grouping
  // ---------------------------------------------------------------------------

  const eventsByDay: Record<number, CalEvent[]> = {}
  const tasksByDay:  Record<number, CalTask[]>  = {}
  for (const e of events) {
    const d = new Date(e.dueDate).getDate()
    ;(eventsByDay[d] ??= []).push(e)
  }
  for (const t of tasks) {
    const d = new Date(t.dueDate).getDate()
    ;(tasksByDay[d] ??= []).push(t)
  }

  const today          = new Date()
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month
  const todayDate      = isCurrentMonth ? today.getDate() : -1

  // ---------------------------------------------------------------------------
  // Shared UI pieces
  // ---------------------------------------------------------------------------

  const weekLabel = (() => {
    const end = new Date(weekStart)
    end.setDate(end.getDate() + 6)
    const startStr = `${MONTHS[weekStart.getMonth()].slice(0, 3)} ${weekStart.getDate()}`
    const endStr   = weekStart.getMonth() === end.getMonth()
      ? String(end.getDate())
      : `${MONTHS[end.getMonth()].slice(0, 3)} ${end.getDate()}`
    return `${startStr}–${endStr}, ${weekStart.getFullYear()}`
  })()

  const legend = (
    <div className="flex items-center gap-4 mb-4 text-xs text-zinc-500 flex-wrap">
      <span className="flex items-center gap-1.5">
        <span className="inline-block w-2.5 h-2.5 rounded-sm bg-blue-100 border border-blue-300" />
        Event (upcoming)
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block w-2.5 h-2.5 rounded-sm bg-red-100 border border-red-300" />
        Event (overdue)
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block w-2.5 h-2.5 rounded-sm bg-teal-50 border-l-2 border-teal-400" />
        Task
      </span>
    </div>
  )

  // Month picker popover (#29)
  const pickerWindow   = monthSummaries.slice(pickerWindowStart, pickerWindowStart + 12)
  const canPickerPrev  = pickerWindowStart > 0
  const canPickerNext  = pickerWindowStart + 12 < monthSummaries.length

  const pickerPopover = pickerOpen && (
    <div
      ref={pickerRef}
      className="absolute top-full mt-1 left-1/2 -translate-x-1/2 z-50 bg-white rounded-xl border border-zinc-200 shadow-lg p-3 w-64"
    >
      {/* Picker header: arrows + Today */}
      <div className="flex items-center justify-between mb-2 pb-2 border-b border-zinc-100">
        <button
          onClick={() => setPickerWindowStart(s => Math.max(0, s - 12))}
          disabled={!canPickerPrev}
          className="p-1 rounded text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          ←
        </button>
        <button
          onClick={() => { router.push('/dashboard/calendar'); setPickerOpen(false); setPickerWindowStart(0) }}
          className="text-xs font-medium text-blue-600 hover:text-blue-700"
        >
          Today
        </button>
        <button
          onClick={() => setPickerWindowStart(s => Math.min(monthSummaries.length - 12, s + 12))}
          disabled={!canPickerNext}
          className="p-1 rounded text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          →
        </button>
      </div>

      {/* 3×4 month grid */}
      <div className="grid grid-cols-3 gap-1">
        {pickerWindow.map((ms, i) => {
          const isSelected = ms.year === year && ms.month === month
          const dotClass   = ms.hasOverdue  ? 'bg-red-500'
            : ms.hasDueSoon  ? 'bg-yellow-400'
            : ms.hasUpcoming ? 'bg-blue-400'
            : null
          return (
            <button
              key={i}
              onClick={() => {
                router.push(`/dashboard/calendar?month=${ms.month}&year=${ms.year}`)
                setPickerOpen(false)
              }}
              className={`p-2 rounded-lg text-center transition-colors hover:bg-zinc-50 ${isSelected ? 'bg-blue-50 ring-1 ring-blue-300' : ''}`}
            >
              <div className={`text-xs font-medium ${isSelected ? 'text-blue-700' : 'text-zinc-700'}`}>
                {MONTHS[ms.month].slice(0, 3)}
              </div>
              <div className="text-xs text-zinc-400">{ms.year}</div>
              <div className="h-2 mt-0.5 flex justify-center items-center">
                {dotClass && <span className={`inline-block w-1.5 h-1.5 rounded-full ${dotClass}`} />}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )

  const header = (
    <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
      {/* Left: title + view toggle (#16) */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold text-zinc-900">Calendar</h1>
        <div className="flex bg-zinc-100 rounded-lg p-0.5 text-xs font-medium">
          <button
            onClick={() => setView('month')}
            className={`px-3 py-1 rounded-md transition-colors ${view === 'month' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
          >
            Month
          </button>
          <button
            onClick={() => setView('week')}
            className={`px-3 py-1 rounded-md transition-colors ${view === 'week' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
          >
            Week
          </button>
        </div>
      </div>

      {/* Right: export / today / prev / month-year picker / next */}
      <div className="flex items-center gap-2">
        <a
          href="/api/calendar/export"
          className="px-3 py-1.5 text-sm font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-md transition-colors"
        >
          Export ICS
        </a>
        {!isCurrentMonth && (
          <button
            onClick={() => router.push('/dashboard/calendar')}
            className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
          >
            Today
          </button>
        )}
        <button
          onClick={() => view === 'week' ? navigateWeek(-1) : navigateMonth(-1)}
          className="px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 rounded-md transition-colors"
        >
          ← Prev
        </button>

        {/* Clickable month/year label → opens picker (#29) */}
        <div className="relative">
          <button
            onClick={() => setPickerOpen(v => !v)}
            className="text-base font-medium text-zinc-800 min-w-40 text-center hover:text-blue-600 px-2 py-1 rounded-md hover:bg-zinc-50 transition-colors"
          >
            {view === 'week' ? weekLabel : `${MONTHS[month]} ${year}`}
          </button>
          {pickerPopover}
        </div>

        <button
          onClick={() => view === 'week' ? navigateWeek(1) : navigateMonth(1)}
          className="px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 rounded-md transition-colors"
        >
          Next →
        </button>
      </div>
    </div>
  )

  // ---------------------------------------------------------------------------
  // Month view
  // ---------------------------------------------------------------------------

  if (view === 'month') {
    const firstDay    = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const cells: (number | null)[] = [
      ...Array(firstDay).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ]
    while (cells.length % 7 !== 0) cells.push(null)

    return (
      <div>
        {header}
        {legend}
        <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
          <div className="grid grid-cols-7 border-b border-zinc-200">
            {DAY_NAMES.map(d => (
              <div key={d} className="py-2 text-center text-xs font-semibold text-zinc-400 uppercase tracking-wide">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 divide-x divide-zinc-100">
            {cells.map((day, i) => {
              const isToday   = day === todayDate
              const dayEvents = day ? (eventsByDay[day] ?? []) : []
              const dayTasks  = day ? (tasksByDay[day]  ?? []) : []
              const total     = dayEvents.length + dayTasks.length
              const MAX       = 3

              return (
                <div
                  key={i}
                  className={`min-h-28 p-1.5 ${i >= 7 ? 'border-t border-zinc-100' : ''} ${!day ? 'bg-zinc-50' : ''}`}
                >
                  {day && (
                    <>
                      <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-blue-600 text-white' : 'text-zinc-700'}`}>
                        {day}
                      </div>
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, MAX).map(e => <EventChip key={e.id} e={e} onSelect={handleEventSelect} />)}
                        {dayTasks.slice(0, Math.max(0, MAX - dayEvents.length)).map(t => <TaskChip key={t.id} t={t} />)}
                        {total > MAX && (
                          <div className="text-xs text-zinc-400 px-1.5">+{total - MAX} more</div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Week view (#16)
  // ---------------------------------------------------------------------------

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return d
  })

  return (
    <div>
      {header}
      {legend}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-zinc-200">
          {weekDays.map((d, i) => {
            const isToday = d.toDateString() === today.toDateString()
            return (
              <div key={i} className="py-2 text-center border-r last:border-r-0 border-zinc-100">
                <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">{DAY_NAMES[d.getDay()]}</div>
                <div className={`mx-auto mt-0.5 w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium ${isToday ? 'bg-blue-600 text-white' : 'text-zinc-700'}`}>
                  {d.getDate()}
                </div>
              </div>
            )
          })}
        </div>

        {/* Day columns */}
        <div className="grid grid-cols-7 divide-x divide-zinc-100 min-h-64">
          {weekDays.map((d, i) => {
            const inMonth   = d.getMonth() === month && d.getFullYear() === year
            const dayEvents = inMonth ? (eventsByDay[d.getDate()] ?? []) : []
            const dayTasks  = inMonth ? (tasksByDay[d.getDate()]  ?? []) : []
            const empty     = dayEvents.length === 0 && dayTasks.length === 0

            return (
              <div key={i} className={`p-1.5 ${!inMonth ? 'bg-zinc-50' : ''}`}>
                {!inMonth ? (
                  <div className="text-xs text-zinc-300 text-center mt-4">
                    {MONTHS[d.getMonth()].slice(0, 3)}
                  </div>
                ) : empty ? null : (
                  <div className="space-y-0.5">
                    {dayEvents.map(e => <EventChip key={e.id} e={e} onSelect={handleEventSelect} />)}
                    {dayTasks.map(t  => <TaskChip  key={t.id} t={t} />)}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Event detail/edit slide-over */}
      <EventSlideOver
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />
    </div>
  )
}
