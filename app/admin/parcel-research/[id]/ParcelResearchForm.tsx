'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

type Props = {
  requestId: string
  status: string
  notes: string
  cacheValues: Record<string, unknown>
}

type FormState = {
  irsLienPresent: string
  bankruptcyStay: string
  waterAvailable: string
  sewerAvailable: string
  gasAvailable: string
  quietTitleRequired: string
  hoaPresent: string
  hoaMonthlyFee: string
  survivingLiens: string
  deedQuality: string
  conditionScore: string
  topography: string
  wetlandsAcres: string
  notes: string
}

export default function ParcelResearchForm({ requestId, status, notes, cacheValues }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(() => initialState(cacheValues, notes))

  function update(key: keyof FormState, value: string) {
    setForm(current => ({ ...current, [key]: value }))
  }

  function submit(nextStatus: 'IN_PROGRESS' | 'COMPLETE') {
    setMessage(null)
    startTransition(async () => {
      const response = await fetch(`/api/admin/parcel-research/${requestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: nextStatus,
          fields: toPayload(form),
        }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: unknown } | null
        setMessage(typeof body?.error === 'string' ? body.error : 'Research update failed.')
        return
      }
      setMessage(nextStatus === 'COMPLETE' ? 'Research marked complete.' : 'Research saved in progress.')
      router.refresh()
    })
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Manual Research Fields</h2>
          <p className="mt-0.5 text-sm text-zinc-500">Saved values write to manual parcel cache and invalidate exit analysis.</p>
        </div>
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
          Current status: {status.toLowerCase().replaceAll('_', ' ')}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <BooleanField label="IRS lien present" value={form.irsLienPresent} onChange={value => update('irsLienPresent', value)} />
        <BooleanField label="Bankruptcy stay" value={form.bankruptcyStay} onChange={value => update('bankruptcyStay', value)} />
        <BooleanField label="Water available" value={form.waterAvailable} onChange={value => update('waterAvailable', value)} />
        <BooleanField label="Sewer available" value={form.sewerAvailable} onChange={value => update('sewerAvailable', value)} />
        <BooleanField label="Gas available" value={form.gasAvailable} onChange={value => update('gasAvailable', value)} />
        <BooleanField label="Quiet title required" value={form.quietTitleRequired} onChange={value => update('quietTitleRequired', value)} />
        <BooleanField label="HOA present" value={form.hoaPresent} onChange={value => update('hoaPresent', value)} />
        <TextField label="HOA monthly fee" type="number" value={form.hoaMonthlyFee} onChange={value => update('hoaMonthlyFee', value)} />
        <TextField label="Condition score" type="number" value={form.conditionScore} onChange={value => update('conditionScore', value)} />
        <label className="block">
          <span className="text-xs font-medium text-zinc-500">Deed quality</span>
          <select
            value={form.deedQuality}
            onChange={event => update('deedQuality', event.target.value)}
            className="mt-1 h-9 w-full rounded-lg border border-zinc-300 bg-white px-2 text-sm text-zinc-900"
          >
            <option value="">Unknown</option>
            <option value="insurable">Insurable</option>
            <option value="conditional">Conditional</option>
            <option value="uninsurable">Uninsurable</option>
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-zinc-500">Topography</span>
          <select
            value={form.topography}
            onChange={event => update('topography', event.target.value)}
            className="mt-1 h-9 w-full rounded-lg border border-zinc-300 bg-white px-2 text-sm text-zinc-900"
          >
            <option value="">Unknown</option>
            <option value="flat">Flat</option>
            <option value="sloped">Sloped</option>
            <option value="hilly">Hilly</option>
            <option value="wetland">Wetland</option>
          </select>
        </label>
        <TextField label="Wetlands acres" type="number" value={form.wetlandsAcres} onChange={value => update('wetlandsAcres', value)} />
      </div>

      <label className="mt-4 block">
        <span className="text-xs font-medium text-zinc-500">Surviving liens</span>
        <textarea
          value={form.survivingLiens}
          onChange={event => update('survivingLiens', event.target.value)}
          rows={4}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
        />
      </label>

      <label className="mt-4 block">
        <span className="text-xs font-medium text-zinc-500">Admin notes</span>
        <textarea
          value={form.notes}
          onChange={event => update('notes', event.target.value)}
          rows={4}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
        />
      </label>

      <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
        {message && (
          <span className={message.includes('failed') ? 'mr-auto text-sm text-red-600' : 'mr-auto text-sm text-emerald-700'}>
            {message}
          </span>
        )}
        <button
          type="button"
          onClick={() => submit('IN_PROGRESS')}
          disabled={isPending}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
        >
          Save In Progress
        </button>
        <button
          type="button"
          onClick={() => submit('COMPLETE')}
          disabled={isPending}
          className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          Mark Complete
        </button>
      </div>
    </div>
  )
}

function BooleanField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-zinc-500">{label}</span>
      <select
        value={value}
        onChange={event => onChange(event.target.value)}
        className="mt-1 h-9 w-full rounded-lg border border-zinc-300 bg-white px-2 text-sm text-zinc-900"
      >
        <option value="">Unknown</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    </label>
  )
}

function TextField({
  label,
  type,
  value,
  onChange,
}: {
  label: string
  type: 'number' | 'text'
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-zinc-500">{label}</span>
      <input
        type={type}
        min={type === 'number' ? '0' : undefined}
        value={value}
        onChange={event => onChange(event.target.value)}
        className="mt-1 h-9 w-full rounded-lg border border-zinc-300 px-2 text-sm text-zinc-900"
      />
    </label>
  )
}

function initialState(cacheValues: Record<string, unknown>, notes: string): FormState {
  const hoa = readRecord(cacheValues.hoa)
  return {
    irsLienPresent: boolString(cacheValues.irsLienPresent),
    bankruptcyStay: boolString(cacheValues.bankruptcyStay),
    waterAvailable: boolString(cacheValues.waterAvailable),
    sewerAvailable: boolString(cacheValues.sewerAvailable),
    gasAvailable: boolString(cacheValues.gasAvailable),
    quietTitleRequired: boolString(cacheValues.quietTitleRequired),
    hoaPresent: boolString(hoa?.present),
    hoaMonthlyFee: numberString(hoa?.monthlyFee),
    survivingLiens: Array.isArray(cacheValues.survivingLiens) ? cacheValues.survivingLiens.join('\n') : '',
    deedQuality: typeof cacheValues.deedQuality === 'string' ? cacheValues.deedQuality : '',
    conditionScore: numberString(cacheValues.conditionScore),
    topography: typeof cacheValues.topography === 'string' ? cacheValues.topography : '',
    wetlandsAcres: numberString(cacheValues.wetlandsAcres),
    notes,
  }
}

function toPayload(form: FormState) {
  return {
    irsLienPresent: readBoolean(form.irsLienPresent),
    bankruptcyStay: readBoolean(form.bankruptcyStay),
    waterAvailable: readBoolean(form.waterAvailable),
    sewerAvailable: readBoolean(form.sewerAvailable),
    gasAvailable: readBoolean(form.gasAvailable),
    quietTitleRequired: readBoolean(form.quietTitleRequired),
    hoaPresent: readBoolean(form.hoaPresent),
    hoaMonthlyFee: readNumber(form.hoaMonthlyFee),
    survivingLiens: form.survivingLiens.split(/[\n,]/).map(item => item.trim()).filter(Boolean),
    deedQuality: form.deedQuality || undefined,
    conditionScore: readNumber(form.conditionScore),
    topography: form.topography || undefined,
    wetlandsAcres: readNumber(form.wetlandsAcres),
    notes: form.notes,
  }
}

function readBoolean(value: string) {
  if (value === 'true') return true
  if (value === 'false') return false
  return undefined
}

function readNumber(value: string) {
  if (value.trim() === '') return null
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : null
}

function boolString(value: unknown) {
  return typeof value === 'boolean' ? String(value) : ''
}

function numberString(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : ''
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}
