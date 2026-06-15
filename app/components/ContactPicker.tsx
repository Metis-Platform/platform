'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import Link from 'next/link'
import type { ContactType } from '@/app/generated/prisma'

type ContactSummary = {
  id: string
  firstName: string | null
  lastName: string | null
  company: string | null
  email: string | null
  phone: string | null
  type: ContactType
}

type Props = {
  /** hidden input name that posts the contactId to the server action */
  name: string
  /** initially linked contact (from server) */
  initial: ContactSummary | null
  /** filter the search dropdown to a specific contact type */
  filterType?: ContactType
  label: string
  /** called after link/unlink so parent can refresh without full navigation */
  onChangePending?: () => void
}

function contactLabel(c: ContactSummary) {
  return [c.firstName, c.lastName].filter(Boolean).join(' ') || c.company || c.email || c.id
}

export default function ContactPicker({ name, initial, filterType, label, onChangePending }: Props) {
  const [linked, setLinked] = useState<ContactSummary | null>(initial)
  const [picking, setPicking] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ContactSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (picking) inputRef.current?.focus()
  }, [picking])

  function closePicker() {
    setPicking(false)
    setQuery('')
    setResults([])
  }

  useEffect(() => {
    if (!picking) return
    const id = setTimeout(async () => {
      setLoading(true)
      const params = new URLSearchParams()
      if (query) params.set('q', query)
      if (filterType) params.set('type', filterType)
      const res = await fetch(`/api/contacts?${params}`)
      const data = await res.json()
      setResults(data.contacts ?? [])
      setLoading(false)
    }, 200)
    return () => clearTimeout(id)
  }, [query, picking, filterType])

  function select(c: ContactSummary) {
    startTransition(() => {
      setLinked(c)
      closePicker()
      onChangePending?.()
    })
  }

  function unlink() {
    startTransition(() => {
      setLinked(null)
      onChangePending?.()
    })
  }

  return (
    <div className="space-y-1">
      <span className="block text-xs font-medium text-zinc-500">{label}</span>

      {/* Hidden input carries the value into the form */}
      <input type="hidden" name={name} value={linked?.id ?? ''} />

      {linked ? (
        <div className="flex items-center gap-2 p-2 bg-zinc-50 border border-zinc-200 rounded-lg">
          <div className="flex-1 min-w-0">
            <Link
              href={`/dashboard/contacts/${linked.id}`}
              className="text-sm font-medium text-blue-600 hover:underline truncate block"
              target="_blank"
            >
              {contactLabel(linked)}
            </Link>
            {linked.email && <div className="text-xs text-zinc-400 truncate">{linked.email}</div>}
            {linked.phone && !linked.email && <div className="text-xs text-zinc-400">{linked.phone}</div>}
          </div>
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="text-xs text-zinc-400 hover:text-zinc-700 shrink-0"
          >
            Change
          </button>
          <button
            type="button"
            onClick={unlink}
            className="text-xs text-red-400 hover:text-red-600 shrink-0"
          >
            Unlink
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="text-xs text-zinc-500 border border-dashed border-zinc-300 rounded-lg px-3 py-1.5 hover:border-zinc-400 hover:text-zinc-700 transition-colors"
        >
          + Link contact
        </button>
      )}

      {picking && (
        <div className="border border-zinc-200 rounded-lg bg-white shadow-sm overflow-hidden">
          <div className="p-2 border-b border-zinc-100">
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search contacts…"
              className="w-full text-sm px-2 py-1 focus:outline-none"
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {loading && (
              <div className="px-3 py-2 text-xs text-zinc-400">Searching…</div>
            )}
            {!loading && results.length === 0 && (
              <div className="px-3 py-2 text-xs text-zinc-400">
                No contacts found.{' '}
                <Link href="/dashboard/contacts/new" target="_blank" className="text-blue-600 hover:underline">
                  Add one
                </Link>
              </div>
            )}
            {results.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => select(c)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-50 transition-colors border-b border-zinc-50 last:border-0"
              >
                <div className="font-medium text-zinc-800">{contactLabel(c)}</div>
                {c.email && <div className="text-xs text-zinc-400">{c.email}</div>}
              </button>
            ))}
          </div>
          <div className="p-2 border-t border-zinc-100">
            <button
              type="button"
              onClick={closePicker}
              className="text-xs text-zinc-400 hover:text-zinc-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
