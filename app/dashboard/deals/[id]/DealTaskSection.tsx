'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type TaskUser = { id: string; name: string | null; email: string }

export type DealTask = {
  id: string
  title: string
  status: string
  priority: string
  dueDate: string | null
  assignedTo: TaskUser | null
  checklistKey: string | null
}

const PRIORITY_BADGE: Record<string, string> = {
  URGENT: 'bg-red-100 text-red-700',
  HIGH:   'bg-orange-100 text-orange-700',
  MEDIUM: 'bg-yellow-100 text-yellow-700',
  LOW:    'bg-zinc-100 text-zinc-500',
}

const NEXT_STATUS: Record<string, string> = { OPEN: 'IN_PROGRESS', IN_PROGRESS: 'COMPLETED', COMPLETED: 'OPEN' }

export default function DealTaskSection({
  dealId,
  initialTasks,
  hasChecklist = false,
}: {
  dealId: string
  initialTasks: DealTask[]
  hasChecklist?: boolean
}) {
  const [tasks, setTasks] = useState(initialTasks)
  const [showCompleted, setShowCompleted] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [isGenerating, setIsGenerating] = useState(false)
  const [nowMs] = useState(() => Date.now())
  const router = useRouter()

  const open = tasks.filter(t => t.status !== 'COMPLETED')
  const completed = tasks.filter(t => t.status === 'COMPLETED')
  const checklistTasks = tasks.filter(t => t.checklistKey !== null)
  const checklistCompleted = checklistTasks.filter(t => t.status === 'COMPLETED').length

  function generateChecklist() {
    setIsGenerating(true)
    startTransition(async () => {
      try {
        await fetch(`/api/deals/${dealId}/checklist`, { method: 'POST' })
        router.refresh()
      } finally {
        setIsGenerating(false)
      }
    })
  }

  function advanceStatus(task: DealTask) {
    const next = NEXT_STATUS[task.status]
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: next } : t))
    startTransition(async () => {
      try {
        await fetch(`/api/tasks/${task.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: next }),
        })
        router.refresh()
      } catch {
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: task.status } : t))
      }
    })
  }

  return (
    <div id="deal-tasks" className="bg-white rounded-xl border border-zinc-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-zinc-900">
            Tasks
            {open.length > 0 && <span className="ml-2 text-xs font-normal text-zinc-400">{open.length} open</span>}
          </h2>
          {checklistTasks.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700">
              DD: {checklistCompleted}/{checklistTasks.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasChecklist && checklistTasks.length === 0 && (
            <button
              onClick={generateChecklist}
              disabled={isGenerating || isPending}
              className="px-3 py-1.5 text-xs font-medium text-violet-600 border border-violet-200 rounded-lg hover:bg-violet-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? 'Generating...' : 'Generate DD Checklist'}
            </button>
          )}
          <Link
            href={`/dashboard/tasks?dealId=${dealId}`}
            className="px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
          >
            + Add Task
          </Link>
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-sm text-zinc-400">No tasks yet.</p>
          <Link href={`/dashboard/tasks?dealId=${dealId}`} className="mt-2 inline-block text-sm text-blue-600 hover:underline">
            + Add Task
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {open.map(task => <TaskRow key={task.id} task={task} onAdvance={advanceStatus} isPending={isPending} nowMs={nowMs} />)}

          {completed.length > 0 && (
            <>
              <button
                onClick={() => setShowCompleted(v => !v)}
                className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors pt-2"
              >
                {showCompleted ? `Hide ${completed.length} completed` : `Show ${completed.length} completed`}
              </button>
              {showCompleted && completed.map(task => (
                <TaskRow key={task.id} task={task} onAdvance={advanceStatus} isPending={isPending} nowMs={nowMs} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function TaskRow({ task, onAdvance, isPending, nowMs }: { task: DealTask; onAdvance: (t: DealTask) => void; isPending: boolean; nowMs: number }) {
  const overdue = task.dueDate && task.status !== 'COMPLETED' && new Date(task.dueDate).getTime() < nowMs
  const daysUntil = task.dueDate ? Math.round((new Date(task.dueDate).getTime() - nowMs) / 86_400_000) : null

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-zinc-100 bg-zinc-50">
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${task.status === 'COMPLETED' ? 'line-through text-zinc-400 opacity-60' : 'text-zinc-900'}`}>
          {task.title}
        </p>
        <div className="flex items-center gap-2 mt-1 text-xs text-zinc-400">
          <span className={`px-1.5 py-0.5 rounded font-medium ${PRIORITY_BADGE[task.priority] ?? 'bg-zinc-100 text-zinc-500'}`}>
            {task.priority}
          </span>
          {task.dueDate && (
            <span className={overdue ? 'text-red-500 font-medium' : ''}>
              {overdue ? `${Math.abs(daysUntil!)}d overdue` : daysUntil === 0 ? 'Due today' : `${daysUntil}d`}
            </span>
          )}
          {task.assignedTo && <span>{task.assignedTo.name ?? task.assignedTo.email}</span>}
        </div>
      </div>
      <button
        onClick={() => onAdvance(task)}
        disabled={isPending}
        className={`flex-shrink-0 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
          task.status === 'COMPLETED'
            ? 'bg-zinc-100 text-zinc-400 hover:bg-zinc-200'
            : task.status === 'IN_PROGRESS'
              ? 'bg-green-100 text-green-700 hover:bg-green-200'
              : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
        }`}
      >
        {task.status === 'OPEN' ? 'Start →' : task.status === 'IN_PROGRESS' ? 'Complete ✓' : 'Reopen'}
      </button>
    </div>
  )
}
