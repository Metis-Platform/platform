'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type User = { id: string; name: string | null; email: string }
type Deal = { id: string; apn: string; address: string | null }
type TaskComment = { id: string; body: string; createdAt: string; user: User }

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
  comments: TaskComment[]
}

const PRIORITY_BADGE: Record<string, string> = {
  URGENT: 'bg-red-100 text-red-700',
  HIGH:   'bg-orange-100 text-orange-700',
  MEDIUM: 'bg-yellow-100 text-yellow-700',
  LOW:    'bg-zinc-100 text-zinc-500',
}

const TASK_TYPES = [
  { value: 'CUSTOM',               label: 'Custom' },
  { value: 'SEND_NOTICE',          label: 'Send Notice' },
  { value: 'FILE_SUIT',            label: 'File Suit' },
  { value: 'ORDER_TITLE_SEARCH',   label: 'Order Title Search' },
  { value: 'RECORD_DOCUMENT',      label: 'Record Document' },
  { value: 'PAY_SUBSEQUENT_TAXES', label: 'Pay Subsequent Taxes' },
  { value: 'REVIEW_REDEMPTION',    label: 'Review Redemption' },
  { value: 'INITIATE_FORECLOSURE', label: 'Initiate Foreclosure' },
  { value: 'FOLLOW_UP',            label: 'Follow Up' },
]

const STATUS_TABS = [
  { key: 'OPEN',        label: 'Open' },
  { key: 'IN_PROGRESS', label: 'In Progress' },
  { key: 'COMPLETED',   label: 'Completed' },
]

const NEXT_STATUS: Record<string, string> = { OPEN: 'IN_PROGRESS', IN_PROGRESS: 'COMPLETED', COMPLETED: 'OPEN' }
const NEXT_LABEL:  Record<string, string> = { OPEN: 'Start', IN_PROGRESS: 'Complete', COMPLETED: 'Reopen' }

const emptyForm = { dealId: '', title: '', description: '', taskType: 'CUSTOM', priority: 'MEDIUM', dueDate: '', assignedToId: '' }

export default function TaskBoard({
  tasks: initial, users, deals, prefilledDealId,
}: {
  tasks: Task[]; users: User[]; deals: Deal[]; prefilledDealId?: string
}) {
  const [tasks, setTasks]           = useState(initial)
  const [activeTab, setActiveTab]   = useState('OPEN')
  const [selectedTask, setSelected] = useState<Task | null>(null)
  const [showCreate, setShowCreate] = useState(!!prefilledDealId)
  const [form, setForm]             = useState({ ...emptyForm, dealId: prefilledDealId ?? '' })
  const [formSaving, setFormSaving] = useState(false)
  const [formError, setFormError]   = useState('')
  const [commentText, setCommentText] = useState('')
  const [commentSaving, setCommentSaving] = useState(false)
  const [commentError, setCommentError] = useState('')
  const [editing, setEditing]       = useState(false)
  const [editForm, setEditForm]     = useState<Record<string, string>>({})
  const [isPending, startTransition] = useTransition()
  const [nowMs] = useState(() => Date.now())
  const router = useRouter()

  function applyPatch(id: string, patch: Partial<Task>) {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t))
    setSelected(prev => prev?.id === id ? { ...prev, ...patch } : prev)
  }

  function handleStatusToggle(task: Task) {
    const next = NEXT_STATUS[task.status]
    applyPatch(task.id, { status: next, completedAt: next === 'COMPLETED' ? new Date().toISOString() : null })
    startTransition(async () => {
      try {
        await fetch(`/api/tasks/${task.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: next }) })
        router.refresh()
      } catch { applyPatch(task.id, { status: task.status, completedAt: task.completedAt }) }
    })
  }

  function handleAssign(task: Task, userId: string | null) {
    const user = userId ? users.find(u => u.id === userId) ?? null : null
    applyPatch(task.id, { assignedTo: user })
    startTransition(async () => {
      try {
        await fetch(`/api/tasks/${task.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assignedToId: userId }) })
        router.refresh()
      } catch { applyPatch(task.id, { assignedTo: task.assignedTo }) }
    })
  }

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedTask || !commentText.trim()) return
    setCommentSaving(true); setCommentError('')
    try {
      const res = await fetch(`/api/tasks/${selectedTask.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: commentText }),
      })
      if (!res.ok) { setCommentError('Failed to add comment.'); return }
      const created = await res.json()
      applyPatch(selectedTask.id, { comments: [...selectedTask.comments, created] })
      setCommentText('')
      router.refresh()
    } catch { setCommentError('Failed to add comment.') }
    finally { setCommentSaving(false) }
  }

  function handleDelete(task: Task) {
    if (!confirm(`Delete "${task.title}"?`)) return
    setTasks(prev => prev.filter(t => t.id !== task.id))
    setSelected(null)
    startTransition(async () => {
      try {
        await fetch(`/api/tasks/${task.id}`, { method: 'DELETE' })
        router.refresh()
      } catch { setTasks(prev => [task, ...prev]) }
    })
  }

  async function handleEditSave() {
    if (!selectedTask) return
    setFormSaving(true); setFormError('')
    try {
      const body: Record<string, unknown> = { ...editForm }
      if ('dueDate' in editForm) body.dueDate = editForm.dueDate || null
      if ('description' in editForm) body.description = editForm.description || null
      await fetch(`/api/tasks/${selectedTask.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      applyPatch(selectedTask.id, editForm as unknown as Partial<Task>)
      setEditing(false); setEditForm({})
      router.refresh()
    } catch { setFormError('Failed to save.') }
    finally { setFormSaving(false) }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setFormSaving(true); setFormError('')
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          dueDate: form.dueDate || undefined,
          assignedToId: form.assignedToId || undefined,
          description: form.description || undefined,
        }),
      })
      if (!res.ok) { setFormError('Failed to create task.'); return }
      const created = await res.json()
      const deal = deals.find(d => d.id === form.dealId)
      const assignedTo = created.assignedTo ?? (form.assignedToId ? users.find(u => u.id === form.assignedToId) ?? null : null)
      setTasks(prev => [{ id: created.id, dealId: created.dealId, title: created.title, description: created.description,
        taskType: created.taskType, status: created.status, priority: created.priority,
        dueDate: created.dueDate, completedAt: null, apn: deal?.apn ?? '', address: deal?.address ?? null, assignedTo, comments: [] }, ...prev])
      setShowCreate(false); setForm(emptyForm)
      router.refresh()
    } catch { setFormError('Failed to create task.') }
    finally { setFormSaving(false) }
  }

  const visible = tasks.filter(t => t.status === activeTab)
  const counts  = Object.fromEntries(STATUS_TABS.map(s => [s.key, tasks.filter(t => t.status === s.key).length]))
  const fv = (key: string, fallback: string) => editForm[key] ?? fallback

  return (
    <div className="flex gap-6">

      {/* ── Task list ─────────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-zinc-900">Tasks</h1>
          <button onClick={() => { setShowCreate(true); setSelected(null); setEditing(false) }}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
            + New Task
          </button>
        </div>

        <div className="flex gap-1 mb-4 border-b border-zinc-200">
          {STATUS_TABS.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors ${activeTab === tab.key ? 'text-blue-600 border-b-2 border-blue-600 bg-white' : 'text-zinc-500 hover:text-zinc-800'}`}>
              {tab.label}
              {counts[tab.key] > 0 && (
                <span className={`ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-xs ${activeTab === tab.key ? 'bg-blue-100 text-blue-700' : 'bg-zinc-100 text-zinc-500'}`}>
                  {counts[tab.key]}
                </span>
              )}
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-zinc-200">
            <p className="text-zinc-400 text-sm">No tasks here.</p>
            {activeTab === 'OPEN' && <button onClick={() => setShowCreate(true)} className="mt-3 text-sm text-blue-600 hover:underline">Create your first task</button>}
          </div>
        ) : (
          <div className="space-y-2">
            {visible.map(task => {
              const overdue = task.dueDate && task.status !== 'COMPLETED' && new Date(task.dueDate).getTime() < nowMs
              const daysUntil = task.dueDate ? Math.round((new Date(task.dueDate).getTime() - nowMs) / 86_400_000) : null
              return (
                <div key={task.id}
                  className={`bg-white rounded-xl border transition-colors cursor-pointer ${selectedTask?.id === task.id ? 'border-blue-400 shadow-sm' : 'border-zinc-200 hover:border-zinc-300'}`}
                  onClick={() => { setSelected(prev => prev?.id === task.id ? null : task); setShowCreate(false); setEditing(false); setEditForm({}) }}>
                  <div className="flex items-center gap-3 p-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm font-medium ${task.status === 'COMPLETED' ? 'line-through text-zinc-400 opacity-60' : 'text-zinc-900'}`}>{task.title}</p>
                        <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-xs font-medium ${PRIORITY_BADGE[task.priority] ?? 'bg-zinc-100 text-zinc-500'}`}>{task.priority}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-zinc-400">
                        <Link href={`/dashboard/deals/${task.dealId}`} onClick={e => e.stopPropagation()} className="font-mono hover:text-blue-600 transition-colors">{task.apn}</Link>
                        {task.dueDate && <span className={overdue ? 'text-red-500 font-medium' : ''}>{overdue ? `${Math.abs(daysUntil!)}d overdue` : daysUntil === 0 ? 'Due today' : `${daysUntil}d`}</span>}
                        {task.assignedTo && <span>{task.assignedTo.name ?? task.assignedTo.email}</span>}
                        {task.comments.length > 0 && <span>{task.comments.length} comment{task.comments.length === 1 ? '' : 's'}</span>}
                      </div>
                    </div>
                    <button onClick={e => { e.stopPropagation(); handleStatusToggle(task) }} disabled={isPending}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        task.status === 'COMPLETED'
                          ? 'bg-zinc-100 text-zinc-400 hover:bg-zinc-200'
                          : task.status === 'IN_PROGRESS'
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                      }`}>
                      {task.status === 'OPEN' ? 'Start →' : task.status === 'IN_PROGRESS' ? 'Complete ✓' : 'Reopen'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Create panel ──────────────────────────────────────────────────── */}
      {showCreate && (
        <div className="w-80 flex-shrink-0">
          <form onSubmit={handleCreate} className="bg-white rounded-xl border border-zinc-200 p-5 sticky top-8 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-900">New Task</h2>
              <button type="button" onClick={() => setShowCreate(false)} className="text-zinc-400 hover:text-zinc-600 text-lg leading-none">×</button>
            </div>
            {formError && <p className="text-xs text-red-600">{formError}</p>}

            <div>
              <label className="block text-xs text-zinc-500 font-medium mb-1">Deal *</label>
              <select required value={form.dealId} onChange={e => setForm(f => ({ ...f, dealId: e.target.value }))}
                className="w-full text-sm border border-zinc-200 rounded-lg px-2 py-1.5 text-zinc-700">
                <option value="">Select deal…</option>
                {deals.map(d => <option key={d.id} value={d.id}>{d.apn}{d.address ? ` — ${d.address}` : ''}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-500 font-medium mb-1">Title *</label>
              <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Mail notice of intent" maxLength={200}
                className="w-full text-sm border border-zinc-200 rounded-lg px-2 py-1.5 text-zinc-700"/>
            </div>
            <div>
              <label className="block text-xs text-zinc-500 font-medium mb-1">Type</label>
              <select value={form.taskType} onChange={e => setForm(f => ({ ...f, taskType: e.target.value }))}
                className="w-full text-sm border border-zinc-200 rounded-lg px-2 py-1.5 text-zinc-700">
                {TASK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-zinc-500 font-medium mb-1">Priority</label>
                <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                  className="w-full text-sm border border-zinc-200 rounded-lg px-2 py-1.5 text-zinc-700">
                  {['LOW','MEDIUM','HIGH','URGENT'].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-zinc-500 font-medium mb-1">Due Date</label>
                <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                  className="w-full text-sm border border-zinc-200 rounded-lg px-2 py-1.5 text-zinc-700"/>
              </div>
            </div>
            <div>
              <label className="block text-xs text-zinc-500 font-medium mb-1">Assign To</label>
              <select value={form.assignedToId} onChange={e => setForm(f => ({ ...f, assignedToId: e.target.value }))}
                className="w-full text-sm border border-zinc-200 rounded-lg px-2 py-1.5 text-zinc-700">
                <option value="">Unassigned</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name ?? u.email}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-500 font-medium mb-1">Notes</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={3} maxLength={2000} placeholder="Optional…"
                className="w-full text-sm border border-zinc-200 rounded-lg px-2 py-1.5 text-zinc-700 resize-none"/>
            </div>
            <button type="submit" disabled={formSaving}
              className="w-full py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {formSaving ? 'Creating…' : 'Create Task'}
            </button>
          </form>
        </div>
      )}

      {/* ── Detail / Edit panel ───────────────────────────────────────────── */}
      {selectedTask && !showCreate && (
        <div className="w-80 flex-shrink-0">
          <div className="bg-white rounded-xl border border-zinc-200 p-5 sticky top-8">
            <div className="flex items-start justify-between mb-4">
              {editing ? (
                <input value={fv('title', selectedTask.title)} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                  className="flex-1 text-sm font-semibold border border-zinc-300 rounded px-2 py-1 mr-2"/>
              ) : (
                <h2 className="text-sm font-semibold text-zinc-900 leading-snug flex-1">{selectedTask.title}</h2>
              )}
              <button onClick={() => setSelected(null)} className="text-zinc-400 hover:text-zinc-600 text-lg leading-none ml-2">×</button>
            </div>
            {formError && <p className="text-xs text-red-600 mb-2">{formError}</p>}

            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs text-zinc-400 font-medium uppercase tracking-wide mb-0.5">Property</dt>
                <dd>
                  <Link href={`/dashboard/deals/${selectedTask.dealId}`} className="text-blue-600 hover:underline font-mono text-xs">{selectedTask.apn}</Link>
                  {selectedTask.address && <div className="text-xs text-zinc-500 mt-0.5">{selectedTask.address}</div>}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-400 font-medium uppercase tracking-wide mb-0.5">Status</dt>
                <dd className="flex gap-2 items-center">
                  <span className="text-zinc-700 capitalize">{selectedTask.status.replace('_',' ').toLowerCase()}</span>
                  <button onClick={() => handleStatusToggle(selectedTask)} disabled={isPending} className="text-xs text-blue-600 hover:underline">
                    → {NEXT_LABEL[selectedTask.status]}
                  </button>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-400 font-medium uppercase tracking-wide mb-0.5">Type</dt>
                <dd>
                  {editing ? (
                    <select value={fv('taskType', selectedTask.taskType)} onChange={e => setEditForm(f => ({ ...f, taskType: e.target.value }))}
                      className="w-full text-sm border border-zinc-200 rounded px-2 py-1 text-zinc-700">
                      {TASK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  ) : <span className="text-zinc-700">{TASK_TYPES.find(t => t.value === selectedTask.taskType)?.label ?? selectedTask.taskType}</span>}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-400 font-medium uppercase tracking-wide mb-0.5">Priority</dt>
                <dd>
                  {editing ? (
                    <select value={fv('priority', selectedTask.priority)} onChange={e => setEditForm(f => ({ ...f, priority: e.target.value }))}
                      className="w-full text-sm border border-zinc-200 rounded px-2 py-1 text-zinc-700">
                      {['LOW','MEDIUM','HIGH','URGENT'].map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  ) : <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${PRIORITY_BADGE[selectedTask.priority]}`}>{selectedTask.priority}</span>}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-400 font-medium uppercase tracking-wide mb-0.5">Due Date</dt>
                <dd>
                  {editing ? (
                    <input type="date" value={fv('dueDate', selectedTask.dueDate?.slice(0,10) ?? '')} onChange={e => setEditForm(f => ({ ...f, dueDate: e.target.value }))}
                      className="w-full text-sm border border-zinc-200 rounded px-2 py-1 text-zinc-700"/>
                  ) : selectedTask.dueDate
                    ? <span className="text-zinc-700">{new Date(selectedTask.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    : <span className="text-zinc-400">—</span>}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-400 font-medium uppercase tracking-wide mb-0.5">Notes</dt>
                <dd>
                  {editing ? (
                    <textarea value={fv('description', selectedTask.description ?? '')} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                      rows={3} maxLength={2000} className="w-full text-sm border border-zinc-200 rounded px-2 py-1 text-zinc-700 resize-none"/>
                  ) : selectedTask.description
                    ? <span className="text-zinc-600 text-xs leading-relaxed">{selectedTask.description}</span>
                    : <span className="text-zinc-400">—</span>}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-400 font-medium uppercase tracking-wide mb-1">Assigned To</dt>
                <dd>
                  <select className="w-full text-sm border border-zinc-200 rounded-lg px-2 py-1.5 text-zinc-700 bg-white"
                    value={selectedTask.assignedTo?.id ?? ''} onChange={e => handleAssign(selectedTask, e.target.value || null)} disabled={isPending}>
                    <option value="">Unassigned</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name ?? u.email}</option>)}
                  </select>
                </dd>
              </div>
              {selectedTask.completedAt && (
                <div>
                  <dt className="text-xs text-zinc-400 font-medium uppercase tracking-wide mb-0.5">Completed</dt>
                  <dd className="text-zinc-500 text-xs">{new Date(selectedTask.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</dd>
                </div>
              )}
            </dl>


            <div className="mt-5 border-t border-zinc-100 pt-4">
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">Comments</h3>
              <div className="space-y-3 mb-4 max-h-48 overflow-y-auto pr-1">
                {selectedTask.comments.length === 0 ? (
                  <p className="text-xs text-zinc-400">No comments yet.</p>
                ) : selectedTask.comments.map(comment => (
                  <div key={comment.id} className="rounded-lg bg-zinc-50 px-3 py-2">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-medium text-zinc-700 truncate">{comment.user.name ?? comment.user.email}</span>
                      <span className="text-[11px] text-zinc-400 flex-shrink-0">{new Date(comment.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    </div>
                    <p className="text-xs text-zinc-600 whitespace-pre-wrap break-words">{comment.body}</p>
                  </div>
                ))}
              </div>
              <form onSubmit={handleAddComment} className="space-y-2">
                {commentError && <p className="text-xs text-red-600">{commentError}</p>}
                <textarea value={commentText} onChange={e => setCommentText(e.target.value)}
                  rows={3} maxLength={2000} placeholder="Add a comment…"
                  className="w-full text-sm border border-zinc-200 rounded-lg px-2 py-1.5 text-zinc-700 resize-none"/>
                <button type="submit" disabled={commentSaving || !commentText.trim()}
                  className="w-full py-1.5 bg-zinc-900 text-white text-xs font-medium rounded-lg hover:bg-zinc-800 disabled:opacity-50">
                  {commentSaving ? 'Adding…' : 'Add Comment'}
                </button>
              </form>
            </div>

            <div className="mt-5 flex gap-2">
              {editing ? (
                <>
                  <button onClick={handleEditSave} disabled={formSaving}
                    className="flex-1 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
                    {formSaving ? 'Saving…' : 'Save'}
                  </button>
                  <button onClick={() => { setEditing(false); setEditForm({}); setFormError('') }}
                    className="flex-1 py-1.5 border border-zinc-200 text-zinc-600 text-xs font-medium rounded-lg hover:bg-zinc-50">
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => { setEditing(true); setEditForm({}) }}
                    className="flex-1 py-1.5 border border-zinc-200 text-zinc-700 text-xs font-medium rounded-lg hover:bg-zinc-50">
                    Edit
                  </button>
                  <button onClick={() => handleDelete(selectedTask)} disabled={isPending}
                    className="flex-1 py-1.5 border border-red-200 text-red-600 text-xs font-medium rounded-lg hover:bg-red-50 disabled:opacity-50">
                    Delete
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
