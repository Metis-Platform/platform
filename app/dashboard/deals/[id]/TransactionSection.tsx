'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { TRANSACTION_DIRECTION, TRANSACTION_LABELS } from '@/lib/transactions'

export type TxRow = {
  id: string
  type: string
  amount: string   // serialized Decimal as string
  date: string     // ISO
  description: string | null
}

const TYPE_OPTIONS = Object.entries(TRANSACTION_LABELS) as [string, string][]

function fmtAmount(amount: string, type: string): string {
  const dir = TRANSACTION_DIRECTION[type as keyof typeof TRANSACTION_DIRECTION]
  const num = parseFloat(amount)
  const formatted = num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return dir === 'IN' ? `+$${formatted}` : `-$${formatted}`
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function TransactionSection({ dealId, initialTransactions }: { dealId: string; initialTransactions: TxRow[] }) {
  const [transactions, setTransactions] = useState<TxRow[]>(initialTransactions)
  const [showForm, setShowForm] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const router = useRouter()

  // Form state
  const [type, setType] = useState('PURCHASE')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState('')
  const [description, setDescription] = useState('')

  const totalIn = transactions
    .filter(t => TRANSACTION_DIRECTION[t.type as keyof typeof TRANSACTION_DIRECTION] === 'IN')
    .reduce((sum, t) => sum + parseFloat(t.amount), 0)

  const totalOut = transactions
    .filter(t => TRANSACTION_DIRECTION[t.type as keyof typeof TRANSACTION_DIRECTION] === 'OUT')
    .reduce((sum, t) => sum + parseFloat(t.amount), 0)

  function fmt(n: number) {
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  async function handleAdd() {
    setFormError(null)
    const amtNum = parseFloat(amount)
    if (!amount || isNaN(amtNum) || amtNum <= 0) {
      setFormError('Amount must be a positive number.')
      return
    }
    if (!date) {
      setFormError('Date is required.')
      return
    }

    startTransition(async () => {
      try {
        const res = await fetch(`/api/deals/${dealId}/transactions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, amount: amtNum, date, description: description || undefined }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({})) as { error?: string }
          setFormError(err.error ?? 'Failed to save transaction.')
          return
        }
        const newTx = await res.json() as TxRow
        // Normalize the returned tx (amount comes back as number from JSON)
        const normalized: TxRow = {
          ...newTx,
          amount: String(newTx.amount),
          date: typeof newTx.date === 'string' ? newTx.date : new Date(newTx.date as unknown as string).toISOString(),
        }
        setTransactions(prev => [normalized, ...prev])
        setShowForm(false)
        setType('PURCHASE')
        setAmount('')
        setDate('')
        setDescription('')
        router.refresh()
      } catch {
        setFormError('Network error. Please try again.')
      }
    })
  }

  async function handleDelete(tx: TxRow) {
    if (!confirm(`Delete this ${TRANSACTION_LABELS[tx.type as keyof typeof TRANSACTION_LABELS] ?? tx.type} transaction? This cannot be undone.`)) return
    setDeletingId(tx.id)
    try {
      const res = await fetch(`/api/transactions/${tx.id}`, { method: 'DELETE' })
      if (!res.ok) {
        alert('Failed to delete. Please try again.')
        return
      }
      setTransactions(prev => prev.filter(t => t.id !== tx.id))
      router.refresh()
    } catch {
      alert('Network error. Please try again.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 inline">Transactions</h2>
          {transactions.length > 0 && (
            <span className="ml-2 text-xs text-zinc-400">
              In: <span className="text-green-600 font-medium">${fmt(totalIn)}</span>
              {' · '}
              Out: <span className="text-zinc-600 font-medium">${fmt(totalOut)}</span>
            </span>
          )}
        </div>
        <button
          onClick={() => { setShowForm(v => !v); setFormError(null) }}
          className="px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
        >
          {showForm ? 'Cancel' : '+ Add'}
        </button>
      </div>

      {showForm && (
        <div className="mb-5 p-4 rounded-lg border border-zinc-200 bg-zinc-50 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Type</label>
              <select
                value={type}
                onChange={e => setType(e.target.value)}
                className="w-full text-sm border border-zinc-200 rounded-lg px-2 py-1.5 bg-white text-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {TYPE_OPTIONS.map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Amount ($)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full text-sm border border-zinc-200 rounded-lg px-2 py-1.5 bg-white text-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full text-sm border border-zinc-200 rounded-lg px-2 py-1.5 bg-white text-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Description (optional)</label>
              <input
                type="text"
                maxLength={500}
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="e.g. County recorder filing"
                className="w-full text-sm border border-zinc-200 rounded-lg px-2 py-1.5 bg-white text-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          {formError && <p className="text-xs text-red-600">{formError}</p>}
          <button
            onClick={handleAdd}
            disabled={isPending}
            className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      )}

      {transactions.length === 0 ? (
        <p className="text-sm text-zinc-400">No transactions recorded yet.</p>
      ) : (
        <ul className="space-y-2">
          {transactions.map(tx => {
            const dir = TRANSACTION_DIRECTION[tx.type as keyof typeof TRANSACTION_DIRECTION]
            const label = TRANSACTION_LABELS[tx.type as keyof typeof TRANSACTION_LABELS] ?? tx.type
            return (
              <li key={tx.id} className="flex items-center gap-3 p-3 rounded-lg border border-zinc-100 bg-zinc-50 group">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded">
                      {label}
                    </span>
                    <span className="text-xs text-zinc-400">{fmtDate(tx.date)}</span>
                  </div>
                  {tx.description && (
                    <p className="text-xs text-zinc-400 mt-0.5 truncate">{tx.description}</p>
                  )}
                </div>
                <span className={`text-sm font-semibold tabular-nums ${dir === 'IN' ? 'text-green-600' : 'text-zinc-700'}`}>
                  {fmtAmount(tx.amount, tx.type)}
                </span>
                <button
                  onClick={() => handleDelete(tx)}
                  disabled={deletingId === tx.id}
                  className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-500 transition-all text-sm disabled:opacity-50"
                  title="Delete"
                >
                  {deletingId === tx.id ? '…' : '✕'}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
