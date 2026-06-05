'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  createRuleSet,
  activateRuleSet,
  deactivateRuleSet,
  deleteRuleSet,
  createRule,
  updateRule,
  deleteRule,
  bulkApplyRuleSet,
  toggleJurisdictionAvailable,
  type RuleFormData,
} from '@/lib/actions/rules'

// ─── Types ────────────────────────────────────────────────────────────────────

type Rule = {
  id: string
  eventType: string
  label: string
  anchorField: string
  offsetDays: number
  sortOrder: number
  description: string | null
}

type RuleSet = {
  id: string
  name: string
  effectiveDate: string
  isActive: boolean
  rules: Rule[]
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const EVENT_TYPES = [
  { value: 'REDEMPTION_DEADLINE',  label: 'Redemption Deadline' },
  { value: 'NOTICE_MAIL_BY',       label: 'Notice Mail By' },
  { value: 'PUBLICATION_START',    label: 'Publication Start' },
  { value: 'FORECLOSURE_ELIGIBLE', label: 'Foreclosure Eligible' },
  { value: 'FORECLOSURE_DEADLINE', label: 'Foreclosure Deadline' },
  { value: 'AUCTION_DATE',         label: 'Auction Date' },
  { value: 'DEED_ISSUED',          label: 'Deed Issued' },
  { value: 'CUSTOM',               label: 'Custom' },
]

const ANCHOR_FIELDS = [
  { value: 'issueDate', label: 'Issue Date (lien)' },
  { value: 'saleDate',  label: 'Sale Date (deed)' },
]

const BLANK_RULE: RuleFormData = {
  eventType:   'REDEMPTION_DEADLINE',
  label:       '',
  anchorField: 'issueDate',
  offsetDays:  0,
  sortOrder:   0,
  description: '',
}

// ─── Helper ────────────────────────────────────────────────────────────────────

function offsetLabel(days: number) {
  if (days === 0) return '0 days'
  const abs = Math.abs(days)
  const sign = days < 0 ? '-' : '+'
  if (abs % 365 === 0) return `${sign}${abs / 365}y`
  if (abs % 30 === 0)  return `${sign}${abs / 30}mo`
  return `${sign}${abs}d`
}

// ─── Rule form (shared for add & edit) ────────────────────────────────────────

function RuleForm({
  value,
  onChange,
  onSubmit,
  onCancel,
  isPending,
  submitLabel,
}: {
  value: RuleFormData
  onChange: (v: RuleFormData) => void
  onSubmit: () => void
  onCancel: () => void
  isPending: boolean
  submitLabel: string
}) {
  const set = (key: keyof RuleFormData, val: string | number) =>
    onChange({ ...value, [key]: val })

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {/* Event type */}
        <div>
          <label className="block text-xs font-medium text-zinc-600 mb-1">Event Type</label>
          <select
            value={value.eventType}
            onChange={(e) => set('eventType', e.target.value)}
            className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm"
          >
            {EVENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* Anchor */}
        <div>
          <label className="block text-xs font-medium text-zinc-600 mb-1">Anchor Field</label>
          <select
            value={value.anchorField}
            onChange={(e) => set('anchorField', e.target.value)}
            className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm"
          >
            {ANCHOR_FIELDS.map((a) => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </select>
        </div>

        {/* Label */}
        <div className="col-span-2">
          <label className="block text-xs font-medium text-zinc-600 mb-1">Label</label>
          <input
            type="text"
            value={value.label}
            onChange={(e) => set('label', e.target.value)}
            placeholder="e.g. Redemption Deadline (2 Years)"
            className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm"
          />
        </div>

        {/* Offset days */}
        <div>
          <label className="block text-xs font-medium text-zinc-600 mb-1">
            Offset Days
            <span className="ml-1 font-normal text-zinc-400">
              (from anchor · negative = before)
            </span>
          </label>
          <input
            type="number"
            value={value.offsetDays}
            onChange={(e) => set('offsetDays', parseInt(e.target.value) || 0)}
            className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm"
          />
        </div>

        {/* Sort order */}
        <div>
          <label className="block text-xs font-medium text-zinc-600 mb-1">Sort Order</label>
          <input
            type="number"
            value={value.sortOrder}
            onChange={(e) => set('sortOrder', parseInt(e.target.value) || 0)}
            className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm"
          />
        </div>

        {/* Description */}
        <div className="col-span-2">
          <label className="block text-xs font-medium text-zinc-600 mb-1">
            Description
            <span className="ml-1 font-normal text-zinc-400">(optional — statute reference, notes)</span>
          </label>
          <textarea
            value={value.description ?? ''}
            onChange={(e) => set('description', e.target.value)}
            rows={2}
            className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm resize-none"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onSubmit}
          disabled={isPending || !value.label.trim()}
          className="rounded-md bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-40"
        >
          {isPending ? 'Saving…' : submitLabel}
        </button>
        <button
          onClick={onCancel}
          className="text-sm text-zinc-500 hover:text-zinc-900"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─── RuleSetCard ───────────────────────────────────────────────────────────────

function RuleSetCard({
  ruleSet,
  jurisdictionId,
  isPending,
  onActivate,
  onDeactivate,
  onDelete,
}: {
  ruleSet: RuleSet
  jurisdictionId: string
  isPending: boolean
  onActivate: () => void
  onDeactivate: () => void
  onDelete: () => void
}) {
  const router = useRouter()
  const [localPending, startTransition] = useTransition()

  const [addingRule, setAddingRule]     = useState(false)
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null)
  const [ruleForm, setRuleForm]         = useState<RuleFormData>(BLANK_RULE)

  const busy = isPending || localPending

  function startAdd() {
    setRuleForm(BLANK_RULE)
    setAddingRule(true)
    setEditingRuleId(null)
  }

  function startEdit(rule: Rule) {
    setRuleForm({
      eventType:   rule.eventType,
      label:       rule.label,
      anchorField: rule.anchorField,
      offsetDays:  rule.offsetDays,
      sortOrder:   rule.sortOrder,
      description: rule.description ?? '',
    })
    setEditingRuleId(rule.id)
    setAddingRule(false)
  }

  function handleCreateRule() {
    startTransition(async () => {
      await createRule(ruleSet.id, ruleForm)
      setAddingRule(false)
      router.refresh()
    })
  }

  function handleUpdateRule(ruleId: string) {
    startTransition(async () => {
      await updateRule(ruleId, ruleForm)
      setEditingRuleId(null)
      router.refresh()
    })
  }

  function handleDeleteRule(ruleId: string) {
    if (!confirm('Delete this rule?')) return
    startTransition(async () => {
      await deleteRule(ruleId, jurisdictionId)
      router.refresh()
    })
  }

  return (
    <div
      className={`rounded-xl border bg-white shadow-sm ${
        ruleSet.isActive ? 'border-green-300' : 'border-zinc-200'
      }`}
    >
      {/* Card header */}
      <div className="flex items-center justify-between rounded-t-xl px-5 py-4 border-b border-inherit">
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              ruleSet.isActive
                ? 'bg-green-100 text-green-800'
                : 'bg-zinc-100 text-zinc-500'
            }`}
          >
            {ruleSet.isActive ? '● Active' : '○ Inactive'}
          </span>
          <h3 className="text-sm font-semibold text-zinc-900">{ruleSet.name}</h3>
          <span className="text-xs text-zinc-400">
            Effective {new Date(ruleSet.effectiveDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {ruleSet.isActive ? (
            <button
              onClick={onDeactivate}
              disabled={busy}
              className="rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-40"
            >
              Deactivate
            </button>
          ) : (
            <button
              onClick={onActivate}
              disabled={busy}
              className="rounded-md border border-green-600 px-3 py-1 text-xs font-medium text-green-700 hover:bg-green-50 disabled:opacity-40"
            >
              Activate
            </button>
          )}
          <button
            onClick={onDelete}
            disabled={busy}
            className="rounded-md border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Rules table */}
      <div className="px-5 py-4 space-y-2">
        {ruleSet.rules.length === 0 && !addingRule && (
          <p className="text-sm text-zinc-400 italic">No rules yet. Add one below.</p>
        )}

        {ruleSet.rules.map((rule) =>
          editingRuleId === rule.id ? (
            <RuleForm
              key={rule.id}
              value={ruleForm}
              onChange={setRuleForm}
              onSubmit={() => handleUpdateRule(rule.id)}
              onCancel={() => setEditingRuleId(null)}
              isPending={busy}
              submitLabel="Save Rule"
            />
          ) : (
            <div
              key={rule.id}
              className="flex items-start justify-between rounded-lg border border-zinc-100 bg-zinc-50 px-4 py-2.5 gap-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
                    {rule.sortOrder}.
                  </span>
                  <span className="text-sm font-medium text-zinc-900 truncate">{rule.label}</span>
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                    {EVENT_TYPES.find((t) => t.value === rule.eventType)?.label ?? rule.eventType}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-zinc-400">
                  <span>
                    {ANCHOR_FIELDS.find((a) => a.value === rule.anchorField)?.label ?? rule.anchorField}
                    {' '}
                    <span className="font-mono font-medium text-zinc-600">
                      {offsetLabel(rule.offsetDays)}
                    </span>
                    {' '}
                    <span className="text-zinc-400">
                      ({rule.offsetDays} days)
                    </span>
                  </span>
                  {rule.description && (
                    <span className="truncate text-zinc-400 italic">{rule.description}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => startEdit(rule)}
                  className="rounded px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-200"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteRule(rule.id)}
                  disabled={busy}
                  className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50 disabled:opacity-40"
                >
                  ✕
                </button>
              </div>
            </div>
          )
        )}

        {/* Add rule form */}
        {addingRule && (
          <RuleForm
            value={ruleForm}
            onChange={setRuleForm}
            onSubmit={handleCreateRule}
            onCancel={() => setAddingRule(false)}
            isPending={busy}
            submitLabel="Add Rule"
          />
        )}

        {/* Add rule button */}
        {!addingRule && (
          <button
            onClick={startAdd}
            className="mt-1 w-full rounded-lg border border-dashed border-zinc-300 py-2 text-xs text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 transition-colors"
          >
            + Add Rule
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Main client component ────────────────────────────────────────────────────

export default function RulesClient({
  jurisdictionId,
  stateName,
  stateMissingCount,
  isAvailable,
  ruleSets,
}: {
  jurisdictionId: string
  stateName: string
  stateMissingCount: number
  isAvailable: boolean
  ruleSets: RuleSet[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [showNewForm, setShowNewForm] = useState(false)
  const [newName, setNewName]         = useState('')
  const [newDate, setNewDate]         = useState(
    () => new Date().toISOString().slice(0, 10)
  )
  const [bulkResult, setBulkResult]   = useState<number | null>(null)

  function handleToggleAvailable() {
    startTransition(async () => {
      await toggleJurisdictionAvailable(jurisdictionId, !isAvailable)
      router.refresh()
    })
  }

  function handleCreateRuleSet() {
    if (!newName.trim() || !newDate) return
    startTransition(async () => {
      await createRuleSet(jurisdictionId, { name: newName.trim(), effectiveDate: newDate })
      setShowNewForm(false)
      setNewName('')
      router.refresh()
    })
  }

  function handleActivate(ruleSetId: string) {
    startTransition(async () => {
      await activateRuleSet(ruleSetId, jurisdictionId)
      router.refresh()
    })
  }

  function handleDeactivate(ruleSetId: string) {
    startTransition(async () => {
      await deactivateRuleSet(ruleSetId, jurisdictionId)
      router.refresh()
    })
  }

  function handleDeleteRuleSet(ruleSetId: string) {
    if (!confirm('Delete this ruleset and ALL its rules? This cannot be undone.')) return
    startTransition(async () => {
      await deleteRuleSet(ruleSetId, jurisdictionId)
      router.refresh()
    })
  }

  function handleBulkApply(sourceRuleSetId: string) {
    if (
      !confirm(
        `Apply these rules to all ${stateMissingCount} other ${stateName} counties with no active rules?\n\n` +
          'Each county will get its own copy of this ruleset, activated immediately.'
      )
    )
      return
    startTransition(async () => {
      const { applied } = await bulkApplyRuleSet(sourceRuleSetId)
      setBulkResult(applied)
      router.refresh()
    })
  }

  const activeRuleSet = ruleSets.find((rs) => rs.isActive)

  return (
    <div className="space-y-5">
      {/* Availability toggle */}
      <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-5 py-3 shadow-sm">
        <div>
          <p className="text-sm font-medium text-zinc-900">
            Available for deal creation
          </p>
          <p className="text-xs text-zinc-500 mt-0.5">
            {isAvailable
              ? 'This county appears in the new deal form. Users can track deals here.'
              : 'This county is hidden from the new deal form. Enable once rules are configured.'}
          </p>
        </div>
        <button
          onClick={handleToggleAvailable}
          disabled={isPending}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
            isAvailable ? 'bg-emerald-500' : 'bg-zinc-300'
          }`}
          aria-label="Toggle availability"
        >
          <span
            className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
              isAvailable ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Bulk-apply banner — shown when there's an active ruleset and other state counties need rules */}
      {activeRuleSet && stateMissingCount > 0 && bulkResult === null && (
        <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-5 py-3">
          <p className="text-sm text-amber-900">
            <span className="font-semibold">{stateMissingCount}</span> other{' '}
            {stateName} counti{stateMissingCount === 1 ? 'y' : 'es'} have no active
            rules. Propagate{' '}
            <span className="font-medium">&ldquo;{activeRuleSet.name}&rdquo;</span> to all of them?
          </p>
          <button
            onClick={() => handleBulkApply(activeRuleSet.id)}
            disabled={isPending}
            className="ml-4 shrink-0 rounded-lg bg-amber-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-40"
          >
            {isPending ? 'Applying…' : `Apply to all ${stateName} counties`}
          </button>
        </div>
      )}

      {/* Success banner after bulk apply */}
      {bulkResult !== null && (
        <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-5 py-3">
          <span className="text-green-700">✓</span>
          <p className="text-sm text-green-900">
            Applied to{' '}
            <span className="font-semibold">{bulkResult}</span>{' '}
            {stateName} counti{bulkResult === 1 ? 'y' : 'es'}.
          </p>
        </div>
      )}

      {/* Existing rulesets */}
      {ruleSets.length === 0 && !showNewForm && (
        <div className="rounded-xl border-2 border-dashed border-zinc-200 py-10 text-center text-sm text-zinc-400">
          No rulesets yet for this jurisdiction.
          <br />
          Add one to start generating deadline events for deals here.
        </div>
      )}

      {ruleSets.map((rs) => (
        <RuleSetCard
          key={rs.id}
          ruleSet={rs}
          jurisdictionId={jurisdictionId}
          isPending={isPending}
          onActivate={() => handleActivate(rs.id)}
          onDeactivate={() => handleDeactivate(rs.id)}
          onDelete={() => handleDeleteRuleSet(rs.id)}
        />
      ))}

      {/* New RuleSet form */}
      {showNewForm ? (
        <div className="rounded-xl border-2 border-dashed border-blue-300 bg-blue-50 p-6 space-y-4">
          <h3 className="text-sm font-semibold text-zinc-700">New Ruleset</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Florida — Standard Tax Lien 2024"
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Effective Date</label>
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
              />
            </div>
          </div>
          <p className="text-xs text-zinc-500">
            The new ruleset will be <strong>inactive</strong> until you activate it.
            Add rules first, then activate.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={handleCreateRuleSet}
              disabled={isPending || !newName.trim()}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-40"
            >
              {isPending ? 'Creating…' : 'Create Ruleset'}
            </button>
            <button
              onClick={() => setShowNewForm(false)}
              className="text-sm text-zinc-500 hover:text-zinc-900"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowNewForm(true)}
          className="w-full rounded-xl border-2 border-dashed border-zinc-200 py-4 text-sm text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 transition-colors"
        >
          + New Ruleset
        </button>
      )}
    </div>
  )
}
