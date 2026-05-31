'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

type CalEvent = {
  id: string
  dealId: string
  label: string
  dueDate: string
  status: string
  apn: string
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

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-blue-100 text-blue-700',
  OVERDUE: 'bg-red-100 text-red-700',
  COMPLETED: 'bg-green-100 text-green-700',
  OPEN: 'bg-amber-100 text-amber-700',
  IN_PROGRESS: 'bg-purple-100 text-purple-700',
}

const PRIORITY_DOT: Record<string, string> = {
  URGENT: 'bg-red-500',
  HIGH: 'bg-orange-400',
  MEDIUM: 'bg-yellow-400',
  LOW: 'bg-zinc-300',
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export default function CalendarClient({
  year,
  month,
  events,
  tasks,
}: {
  year: number
  month: number
  events: CalEvent[]
  tasks: CalTask[]
}) {
  const router = useRouter()

  function navigate(delta: number) {
    let m = month + delta
    let y = year
    if (m < 0) { m = 11; y -= 1 }
    if (m > 11) { m = 0; y += 1 }
    router.push(`/dashboard/calendar?month=${m}&year=${y}`)
  }

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const eventsByDay: Record<number, CalEvent[]> = {}
  const tasksByDay: Record<number, CalTask[]> = {}

  for (const e of events) {
    const d = new Date(e.dueDate).getDate()
    ;(eventsByDay[d] ??= []).push(e)
  }
  for (const t of tasks) {
    const d = new Date(t.dueDate).getDate()
    ;(tasksByDay[d] ??= []).push(t)
  }

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const today = new Date()
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month
  const todayDate = isCurrentMonth ? today.getDate() : -1

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900">Calendar</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 rounded-md transition-colors"
          >
            ← Prev
          </button>
          <span className="text-base font-medium text-zinc-800 min-w-36 text-center">
            {MONTHS[month]} {year}
          </span>
          <button
            onClick={() => navigate(1)}
            className="px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 rounded-md transition-colors"
          >
            Next →
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-4 text-xs text-zinc-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-blue-100 border border-blue-300" />
          Event (deadline)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-100 border border-amber-300" />
          Task
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-red-100 border border-red-300" />
          Overdue
        </span>
      </div>

      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <div className="grid grid-cols-7 border-b border-zinc-200">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="py-2 text-center text-xs font-semibold text-zinc-400 uppercase tracking-wide">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 divide-x divide-zinc-100">
          {cells.map((day, i) => {
            const isToday = day === todayDate
            const dayEvents = day ? (eventsByDay[day] ?? []) : []
            const dayTasks = day ? (tasksByDay[day] ?? []) : []
            const total = dayEvents.length + dayTasks.length
            const taskSlots = Math.max(0, 3 - dayEvents.length)

            return (
              <div
                key={i}
                className={`min-h-28 p-1.5 ${i >= 7 ? 'border-t border-zinc-100' : ''} ${!day ? 'bg-zinc-50' : ''}`}
              >
                {day && (
                  <>
                    <div
                      className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                        isToday ? 'bg-blue-600 text-white' : 'text-zinc-700'
                      }`}
                    >
                      {day}
                    </div>
                    <div className="space-y-0.5">
                      {dayEvents.slice(0, 3).map(e => (
                        <Link
                          key={e.id}
                          href={`/dashboard/deals/${e.dealId}`}
                          className={`block truncate text-xs px-1.5 py-0.5 rounded ${STATUS_COLORS[e.status] ?? 'bg-zinc-100 text-zinc-600'} hover:opacity-80`}
                          title={`${e.label} — APN ${e.apn}`}
                        >
                          {e.label}
                        </Link>
                      ))}
                      {dayTasks.slice(0, taskSlots).map(t => (
                        <Link
                          key={t.id}
                          href="/dashboard/tasks"
                          className={`flex items-center gap-1 truncate text-xs px-1.5 py-0.5 rounded ${STATUS_COLORS[t.status] ?? 'bg-zinc-100 text-zinc-600'} hover:opacity-80`}
                          title={`Task: ${t.title} — APN ${t.apn}`}
                        >
                          <span className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${PRIORITY_DOT[t.priority] ?? 'bg-zinc-300'}`} />
                          {t.title}
                        </Link>
                      ))}
                      {total > 3 && (
                        <div className="text-xs text-zinc-400 px-1.5">+{total - 3} more</div>
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
