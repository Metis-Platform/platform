'use client'

import { useState } from 'react'

type Member = {
  id: string
  name: string | null
  email: string
  role: string
  createdAt: Date
}

const ROLES = ['OWNER', 'ANALYST', 'ATTORNEY', 'ASSISTANT', 'READ_ONLY'] as const
const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Owner',
  ANALYST: 'Analyst',
  ATTORNEY: 'Attorney',
  ASSISTANT: 'Assistant',
  READ_ONLY: 'Read-Only',
}

export default function TeamClient({
  members: initial,
  currentUserId,
  isOwner,
}: {
  members: Member[]
  currentUserId: string
  isOwner: boolean
}) {
  const [members, setMembers] = useState(initial)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteStatus, setInviteStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle')
  const [roleLoading, setRoleLoading] = useState<string | null>(null)

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviteStatus('loading')
    const res = await fetch('/api/team/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail }),
    })
    if (res.ok) {
      setInviteStatus('sent')
      setInviteEmail('')
    } else {
      setInviteStatus('error')
    }
  }

  async function changeRole(memberId: string, role: string) {
    setRoleLoading(memberId)
    const res = await fetch(`/api/team/members/${memberId}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    })
    if (res.ok) {
      setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, role } : m)))
    }
    setRoleLoading(null)
  }

  return (
    <div className="space-y-8">
      {/* Member list */}
      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 border-b border-zinc-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-zinc-600">Member</th>
              <th className="text-left px-4 py-3 font-medium text-zinc-600">Role</th>
              <th className="text-left px-4 py-3 font-medium text-zinc-600">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {members.map((m) => (
              <tr key={m.id}>
                <td className="px-4 py-3">
                  <div className="font-medium text-zinc-900">{m.name ?? m.email}</div>
                  {m.name && <div className="text-zinc-500 text-xs">{m.email}</div>}
                </td>
                <td className="px-4 py-3">
                  {isOwner && m.id !== currentUserId ? (
                    <select
                      value={m.role}
                      disabled={roleLoading === m.id}
                      onChange={(e) => changeRole(m.id, e.target.value)}
                      className="border border-zinc-300 rounded-md px-2 py-1 text-sm text-zinc-700 disabled:opacity-50"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700">
                      {ROLE_LABELS[m.role] ?? m.role}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-zinc-500">
                  {new Date(m.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Invite form — owners only */}
      {isOwner && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          <h2 className="text-base font-semibold text-zinc-900 mb-1">Invite a team member</h2>
          <p className="text-sm text-zinc-500 mb-4">
            They will receive an email invitation to join your organization.
          </p>
          <form onSubmit={sendInvite} className="flex gap-3">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => { setInviteEmail(e.target.value); setInviteStatus('idle') }}
              placeholder="colleague@example.com"
              required
              className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
            />
            <button
              type="submit"
              disabled={inviteStatus === 'loading'}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 transition-colors"
            >
              {inviteStatus === 'loading' ? 'Sending…' : 'Send invite'}
            </button>
          </form>
          {inviteStatus === 'sent' && (
            <p className="mt-2 text-sm text-emerald-600">Invitation sent.</p>
          )}
          {inviteStatus === 'error' && (
            <p className="mt-2 text-sm text-red-600">Failed to send invitation. Check the email address and try again.</p>
          )}
        </div>
      )}
    </div>
  )
}
