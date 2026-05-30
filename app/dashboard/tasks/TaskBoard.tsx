'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type User = { id: string; name: string | null; email: string }

type Task = {
  id: string
  dealId: string
  title: string
  description: string | null
  taskType: string
  status: string
  priority: string
  dueDate: string | null
  completedAt: string | null
  apn: string
  address: string | null
  assignedTo: User | null
}

const PRIORITY_BADGE: Record<string, string> = {
  URGENT: 'bg-red-100 text-red-700',
  HIGH: 'bg-orange-100 text-orange-700',
  MEDIUM: 'bg-yellow-100 text-yellow-700',
  LOW: 'bg-zinc-100 text-zinc-500',
}

const STATUS_TABS = [
  { key: 'OPEN', label: 'Open' },
  { key: 'IN_PROGRESS', label: 'In Progress' },
  { key: 'COMPLETED', label: 'Completed' },
]

const NEXT_STATUS: Record<string, string> = {
  OPEN: 'IN_PROGRESS',
  IN_PROGRESS: 'COMPLETED',
  COMPLETED: 'OPEN',
}

const NEXT_LABEL: Record<string, string> = {
  OPEN: 'Start',
  IN_PROGRESS: 'Complete',
  COMPLETED: 'Reopen',
}

async function patchTask(id: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error('Failed to update task')
}

export default function TaskBoard({ tasks: initial, users }: { tasks: Task[]; users: User[] }) {
  const [tasks, setTasks] = useState(initial)
  const [activeTab, setActiveTab] = useState('OPEN')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function optimisticUpdate(id: string, patch: Partial<Task>) {
    setTasks(prev => prev.map(t => (t.id === id ? { ...t, ...patch } : t)))
    if (selectedTask?.id === id) setSelectedTask(prev => prev ? { ...prev, ...patch } : null)
  }

  function handleStatusToggle(task: Task) {
    const next = NEXT_STATUS[task.status]
    optimisticUpdate(task.id, { status: next, completedAt: next === 'COMPLETED' ? new Date().toISOString() : null })
    startTransition(async () => {
      try {
        await patchTask(task.id, { status: next })
        router.refresh()
      } catch {
        optimisticUpdate(task.id, { status: task.status, completedAt: task.completedAt })
      }
    })
  }

  function handleAssign(task: Task, userId: string | null) {
    const user = userId ? users.find(u => u.id === userId) ?? null : null
    optimisticUpdate(task.id, { assignedTo: user })
    startTransition(async () => {
      try {
        await patchTask(task.id, { assignedToId: userId })
        router.refresh()
      } catch {
        optimisticUpdate(task.id, { assignedTo: task.assignedTo })
      }
    })
  }

  const visible = tasks.filter(t => t.status === activeTab)
  const counts = Object.fromEntries(STATUS_TABS.map(s => [s.key, tasks.filter(t => t.status === s.key).length]))

  return (
    <div className="flex gap-6">
      <div className="flex-1 min-w-0">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-zinc-900">Tasks</h1>
          <span className="text-sm text-zinc-500">{tasks.filter(t => t.status !== 'COMPLETED').length} open</span>
        </div>

        <div className="flex gap-1 mb-4 border-b border-zinc-200">
          {STATUS_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors ${
                activeTab === tab.key
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                  : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              {tab.label}
              {counts[tab.key] > 0 && (
                <span className={`ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-xs ${
                  activeTab === tab.key ? 'bg-blue-100 text-blue-700' : 'bg-zinc-100 text-zinc-500'
                }`}>
                  {counts[tab.key]}
                </span>
              )}
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-zinc-200">
            <p className="text-zinc-400 text-sm">No tasks here.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {visible.map(task => {
              const overdue = task.dueDate && task.status !== 'COMPLETED' && new Date(task.dueDate) < new Date()
              const daysUntil = task.dueDate
                ? Math.round((new Date(task.dueDate).getTime() - Date.now()) / 86_400_000)
                : null

              return (
                <div
                  key={task.id}
                  className={`bg-white rounded-xl border transition-colors cursor-pointer ${
                    selectedTask?.id === task.id ? 'border-blue-400 shadow-sm' : 'border-zinc-200 hover:border-zinc-300'
                  }`}
                  onClick={() => setSelectedTask(prev => prev?.id === task.id ? null : task)}
                >
                  <div className="flex items-start gap-3 p-4">
                    <button
                      onClick={e => { e.stopPropagation(); handleStatusToggle(task) }}
                      disabled={isPending}
                      className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                        task.status === 'COMPLETED'
                          ? 'border-green-500 bg-green-500'
                          : task.status === 'IN_PROGRESS'
                          ? 'border-purple-400 bg-purple-50'
                          : 'border-zinc-300 bg-white hover:border-blue-400'
                      }`}
                      title={NEXT_LABEL[task.status]}
                    >
                      {task.status === 'COMPLETED' && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <path d="M2 6l3 3 5-5" />
                        </svg>
                      )}
                      {task.status === 'IN_PROGRESS' && (
                        <span className="w-2 h-2 rounded-full bg-purple-400" />
                      )}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm font-medium ${task.status === 'COMPLETED' ? 'line-through text-zinc-400' : 'text-zinc-900'}`}>
                          {task.title}
                        </p>
                        <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-xs font-medium ${PRIORITY_BADGE[task.priority] ?? 'bg-zinc-100 text-zinc-500'}`}>
                          {task.priority}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 mt-1 text-xs text-zinc-400">
                        <Link
                          href={`/dashboard/liens/${task.dealId}`}
                          onClick={e => e.stopPropagation()}
                          className="font-mono hover:text-blue-600 transition-colors"
                        >
                          {task.apn}
                        </Link>
                        {task.dueDate && (
                          <span className={overdue ? 'text-red-500 font-medium' : ''}>
                            {overdue
                              ? `${Math.abs(daysUntil!)}d overdue`
                              : daysUntil === 0
                              ? 'Due today'
                              : `${daysUntil}d`}
                          </span>
                        )}
                        {task.assignedTo && (
                          <span className="text-zinc-500">{task.assignedTo.name ?? task.assignedTo.email}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {selectedTask && (
        <div className="w-80 flex-shrink-0">
          <div className="bg-white rounded-xl border border-zinc-200 p-5 sticky top-8">
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-sm font-semibold text-zinc-900 leading-snug">{selectedTask.title}</h2>
              <button
                onClick={() => setSelectedTask(null)}
                className="text-zinc-400 hover:text-zinc-600 text-lg leading-none ml-2"
              >
                ×
              </button>
            </div>

            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs text-zinc-400 font-medium uppercase tracking-wide mb-0.5">Property</dt>
                <dd>
                  <Link href={`/dashboard/liens/${selectedTask.dealId}`} className="text-blue-600 hover:underline font-mono text-xs">
                    {selectedTask.apn}
                  </Link>
                  {selectedTask.address && <div className="text-xs text-zinc-500 mt-0.5">{selectedTask.address}</div>}
                </dd>
              </div>

              <div>
                <dt className="text-xs text-zinc-400 font-medium uppercase tracking-wide mb-0.5">Status</dt>
                <dd className="flex gap-2 items-center">
                  <span className="text-zinc-700 capitalize">{selectedTask.status.replace('_', ' ').toLowerCase()}</span>
                  <button
                    onClick={() => handleStatusToggle(selectedTask)}
                    disabled={isPending}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    {`→ ${NEXT_LABEL[selectedTask.status]}`}
                  </button>
                </dd>
              </div>

              <div>
                <dt className="text-xs text-zinc-400 font-medium uppercase tracking-wide mb-0.5">Priority</dt>
                <dd>
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${PRIORITY_BADGE[selectedTask.priority]}`}>
                    {selectedTask.priority}
                  </span>
                </dd>
              </div>

              {selectedTask.dueDate && (
                <div>
                  <dt className="text-xs text-zinc-400 font-medium uppercase tracking-wide mb-0.5">Due Date</dt>
                  <dd className="text-zinc-700">
                    {new Date(selectedTask.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </dd>
                </div>
              )}

              {selectedTask.description && (
                <div>
                  <dt className="text-xs text-zinc-400 font-medium uppercase tracking-wide mb-0.5">Notes</dt>
                  <dd className="text-zinc-600 text-xs leading-relaxed">{selectedTask.description}</dd>
                </div>
              )}

              <div>
                <dt className="text-xs text-zinc-400 font-medium uppercase tracking-wide mb-1">Assigned To</dt>
                <dd>
                  <select
                    className="w-full text-sm border border-zinc-200 rounded-lg px-2 py-1.5 text-zinc-700 bg-white"
                    value={selectedTask.assignedTo?.id ?? ''}
                    onChange={e => handleAssign(selectedTask, e.target.value || null)}
                    disabled={isPending}
                  >
                    <option value="">Unassigned</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.name ?? u.email}</option>
                    ))}
                  </select>
                </dd>
              </div>

              {selectedTask.completedAt && (
                <div>
                  <dt className="text-xs text-zinc-400 font-medium uppercase tracking-wide mb-0.5">Completed</dt>
                  <dd className="text-zinc-500 text-xs">
                    {new Date(selectedTask.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      )}
    </div>
  )
}
