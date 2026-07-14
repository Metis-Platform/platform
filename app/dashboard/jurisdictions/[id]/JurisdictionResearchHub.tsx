'use client'

import { useMemo, useState } from 'react'
import {
  CONTACT_FIELDS,
  MARKET_SIGNAL_FIELDS,
  RESEARCH_STRATEGIES,
  STRATEGY_RESEARCH_FIELDS,
  type ResearchFieldDef,
  type ResearchProfile,
  type ResearchProfileField,
  type ResearchStrategy,
} from '@/lib/jurisdiction-research'

type RuleRow = {
  id: string
  label: string
  anchorField: string
  offsetDays: number
  description: string | null
}

type ActiveRuleSet = {
  name: string
  effectiveDate: string
  rules: RuleRow[]
} | null

type Props = {
  jurisdictionId: string
  profile: ResearchProfile
  trackedPropertyCount: number
  timezone: string
  activeRuleSet: ActiveRuleSet
}

type ReportTarget = {
  strategy: ResearchStrategy
  field: ResearchFieldDef
} | null

const VOLATILITY_DAYS: Record<ResearchProfileField['volatility'], number> = {
  static: 1825,
  annual: 455,
  quarterly: 120,
  per_sale: 60,
}

function confidenceTone(confidence: number) {
  if (confidence >= 0.85) return 'bg-emerald-500'
  if (confidence >= 0.6) return 'bg-amber-400'
  return 'bg-red-500'
}

function isSafeExternalUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

function fieldFor(profile: ResearchProfile, field: ResearchFieldDef): ResearchProfileField | null {
  return profile[field.section]?.[field.key] ?? null
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

export function provenanceLabel(field: ResearchProfileField | null): string {
  if (!field) return 'Not yet reviewed'
  if (!field.claimId) return 'Legacy — provenance unavailable'
  const date = field.verifiedAt ? formatDate(field.verifiedAt) : 'date unavailable'
  switch (field.verificationState) {
    case 'VERIFIED': return `Verified: ${date}`
    case 'REVIEWED': return `Reviewed: ${date}`
    case 'STALE': return `Stale — last reviewed ${date}`
    case 'BLOCKED': return 'Blocked — unresolved evidence'
    default: return 'Claim provenance incomplete'
  }
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'Not yet verified'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) return value.length ? value.join(', ') : 'Not yet verified'
  if (typeof value === 'number') return Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined, { maximumFractionDigits: 2 })
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .map(([k, v]) => `${labelize(k)}: ${String(v)}`)
    return entries.length ? entries.join(' · ') : 'Not yet verified'
  }
  return String(value)
}

function labelize(value: string) {
  return value
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function citationLabel(citation: unknown): string | null {
  if (!citation) return null
  if (typeof citation === 'string') return citation
  if (typeof citation === 'object' && citation !== null) {
    const record = citation as Record<string, unknown>
    if (typeof record.label === 'string') return record.label
  }
  return null
}

function citationUrl(citation: unknown): string | null {
  if (typeof citation !== 'object' || citation === null) return null
  const url = (citation as Record<string, unknown>).url
  return typeof url === 'string' && isSafeExternalUrl(url) ? url : null
}

function isStale(field: ResearchProfileField) {
  const verifiedAt = new Date(field.verifiedAt)
  if (Number.isNaN(verifiedAt.getTime())) return false
  const ageDays = (Date.now() - verifiedAt.getTime()) / 86_400_000
  return ageDays > VOLATILITY_DAYS[field.volatility]
}

function numericValue(field: ResearchProfileField | null): number | null {
  const value = Number(field?.value)
  return Number.isFinite(value) ? value : null
}

export default function JurisdictionResearchHub({
  jurisdictionId,
  profile,
  trackedPropertyCount,
  timezone,
  activeRuleSet,
}: Props) {
  const [activeStrategy, setActiveStrategy] = useState<ResearchStrategy>('TAX_LIEN')
  const [reportTarget, setReportTarget] = useState<ReportTarget>(null)
  const [reportText, setReportText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submittedField, setSubmittedField] = useState<string | null>(null)
  const [reportError, setReportError] = useState<string | null>(null)

  const opportunityScore = numericValue(fieldFor(profile, MARKET_SIGNAL_FIELDS[0]))
  const saturationScore = numericValue(fieldFor(profile, MARKET_SIGNAL_FIELDS[1]))
  const activeFields = STRATEGY_RESEARCH_FIELDS[activeStrategy]

  const additionalContacts = useMemo(() => {
    const configured = new Set(CONTACT_FIELDS.map((field) => field.key))
    return Object.keys(profile.contacts ?? {})
      .filter((key) => !configured.has(key))
      .map((key) => ({ section: 'contacts' as const, key, label: labelize(key) }))
  }, [profile.contacts])

  async function submitReport() {
    if (!reportTarget) return
    setSubmitting(true)
    setReportError(null)

    const res = await fetch(`/api/jurisdictions/${jurisdictionId}/field-report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        strategy: reportTarget.strategy,
        section: reportTarget.field.section,
        fieldKey: reportTarget.field.key,
        label: reportTarget.field.label,
        reason: reportText,
      }),
    })

    if (res.ok) {
      setSubmittedField(`${reportTarget.field.section}.${reportTarget.field.key}`)
      setReportTarget(null)
      setReportText('')
    } else {
      setReportError('Unable to submit the report. Try again in a moment.')
    }

    setSubmitting(false)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap gap-1 border-b border-zinc-200 pb-4">
          {RESEARCH_STRATEGIES.map((strategy) => (
            <button
              key={strategy.key}
              type="button"
              onClick={() => setActiveStrategy(strategy.key)}
              className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                activeStrategy === strategy.key
                  ? 'bg-zinc-900 text-white'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
            >
              {strategy.label}
            </button>
          ))}
        </div>

        <div className="mt-5 space-y-3">
          {activeFields.map((field) => (
            <ResearchField
              key={`${field.section}.${field.key}`}
              field={field}
              profileField={fieldFor(profile, field)}
              reported={submittedField === `${field.section}.${field.key}`}
              onReport={() => {
                setReportTarget({ strategy: activeStrategy, field })
                setReportText('')
                setReportError(null)
              }}
            />
          ))}
        </div>

        <RulesSection activeRuleSet={activeRuleSet} />
      </section>

      <aside className="space-y-6">
        <MarketSignalsPanel profile={profile} opportunityScore={opportunityScore} saturationScore={saturationScore} />
        <ContactsSection profile={profile} fields={[...CONTACT_FIELDS, ...additionalContacts]} />
        <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">County notes</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="font-medium text-zinc-500">Timezone</dt>
              <dd className="mt-0.5 text-zinc-900">{timezone}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-500">Tracked properties</dt>
              <dd className="mt-0.5 text-zinc-900">{trackedPropertyCount}</dd>
            </div>
          </dl>
        </section>
      </aside>

      {reportTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">Report outdated info</h2>
                <p className="mt-1 text-sm text-zinc-500">{reportTarget.field.label}</p>
              </div>
              <button
                type="button"
                onClick={() => setReportTarget(null)}
                className="rounded-lg px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100"
              >
                Close
              </button>
            </div>
            <label className="mt-4 block text-sm font-medium text-zinc-700" htmlFor="field-report">
              What is incorrect?
            </label>
            <textarea
              id="field-report"
              value={reportText}
              onChange={(event) => setReportText(event.target.value)}
              rows={4}
              className="mt-2 block w-full resize-none rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
            />
            {reportError && <p className="mt-2 text-sm text-red-600">{reportError}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReportTarget(null)}
                className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitReport}
                disabled={submitting || reportText.trim().length < 3}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ResearchField({
  field,
  profileField,
  reported,
  onReport,
}: {
  field: ResearchFieldDef
  profileField: ResearchProfileField | null
  reported: boolean
  onReport: () => void
}) {
  const hasValue = profileField?.value !== undefined && profileField.value !== null && profileField.value !== ''
  const stale = profileField ? isStale(profileField) : false
  const sourceUrl = profileField?.sourceUrl && isSafeExternalUrl(profileField.sourceUrl) ? profileField.sourceUrl : null
  const citation = citationLabel(profileField?.citation)
  const citationHref = citationUrl(profileField?.citation)

  return (
    <div className="rounded-lg border border-zinc-200 p-4">
      <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)_auto] sm:items-start">
        <div>
          <p className="text-sm font-semibold text-zinc-900">{field.label}</p>
          <p className="mt-1 text-xs text-zinc-400">{field.section}.{field.key}</p>
        </div>
        <div>
          <p className={hasValue ? 'text-sm leading-6 text-zinc-800' : 'text-sm italic leading-6 text-zinc-400'}>
            {formatValue(profileField?.value)}
          </p>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500">
            {sourceUrl ? (
              <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-700 hover:text-blue-900">
                Source
              </a>
            ) : (
              <span>Source: none</span>
            )}
            <span>{provenanceLabel(profileField)}</span>
            {citationHref ? (
              <a href={citationHref} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-700 hover:text-blue-900">
                {citation ?? 'Citation'}
              </a>
            ) : citation ? (
              <span>{citation}</span>
            ) : (
              <span>Citation: none</span>
            )}
            {stale && <span className="font-medium text-amber-700">Review due</span>}
            {reported && <span className="font-medium text-emerald-700">Reported</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 sm:justify-end">
          {profileField && (
            <span
              title={`Confidence ${Math.round(profileField.confidence * 100)}%`}
              className={`h-3 w-3 rounded-full ${confidenceTone(profileField.confidence)}`}
            />
          )}
          <button
            type="button"
            onClick={onReport}
            className="rounded-md border border-zinc-200 px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
          >
            Flag
          </button>
        </div>
      </div>
    </div>
  )
}

function MarketSignalsPanel({
  profile,
  opportunityScore,
  saturationScore,
}: {
  profile: ResearchProfile
  opportunityScore: number | null
  saturationScore: number | null
}) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-zinc-900">Market signals</h2>
      <div className="mt-4 space-y-4">
        <Gauge
          label="Opportunity"
          value={opportunityScore}
          tone="bg-emerald-500"
          provenance={provenanceLabel(fieldFor(profile, MARKET_SIGNAL_FIELDS[0]))}
        />
        <Gauge
          label="Saturation"
          value={saturationScore}
          tone="bg-amber-500"
          provenance={provenanceLabel(fieldFor(profile, MARKET_SIGNAL_FIELDS[1]))}
        />
      </div>
      <dl className="mt-5 space-y-3 text-sm">
        {MARKET_SIGNAL_FIELDS.slice(2).map((field) => {
          const profileField = fieldFor(profile, field)
          return (
            <div key={field.key} className="flex items-start justify-between gap-3">
              <dt className="text-zinc-500">{field.label}</dt>
              <dd className={profileField ? 'text-right font-medium text-zinc-900' : 'text-right italic text-zinc-400'}>
                {formatValue(profileField?.value)}
                <span className="mt-0.5 block text-xs font-normal text-zinc-400">
                  {provenanceLabel(profileField)}
                </span>
              </dd>
            </div>
          )
        })}
      </dl>
    </section>
  )
}

function Gauge({
  label,
  value,
  tone,
  provenance,
}: {
  label: string
  value: number | null
  tone: string
  provenance: string
}) {
  const width = value === null ? 0 : Math.min(100, Math.max(0, value))
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-zinc-700">{label}</span>
        <span className={value === null ? 'italic text-zinc-400' : 'font-semibold text-zinc-900'}>
          {value === null ? 'Not yet verified' : `${Math.round(value)}/100`}
        </span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-zinc-100">
        <div className={`h-2 rounded-full ${tone}`} style={{ width: `${width}%` }} />
      </div>
      <p className="mt-1 text-xs text-zinc-400">{provenance}</p>
    </div>
  )
}

function ContactsSection({ profile, fields }: { profile: ResearchProfile; fields: ResearchFieldDef[] }) {
  return (
    <details className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm" open>
      <summary className="cursor-pointer text-lg font-semibold text-zinc-900">Contacts directory</summary>
      <div className="mt-4 space-y-3">
        {fields.map((field) => {
          const profileField = fieldFor(profile, field)
          return <ContactRow key={field.key} label={field.label} field={profileField} />
        })}
      </div>
    </details>
  )
}

function ContactRow({ label, field }: { label: string; field: ResearchProfileField | null }) {
  const value = typeof field?.value === 'object' && field.value !== null && !Array.isArray(field.value)
    ? field.value as Record<string, unknown>
    : null
  const phone = typeof value?.phone === 'string' ? value.phone : null
  const email = typeof value?.email === 'string' ? value.email : null
  const website = typeof value?.website === 'string' && isSafeExternalUrl(value.website) ? value.website : null
  const name = typeof value?.name === 'string' ? value.name : null

  return (
    <div className="rounded-lg border border-zinc-200 p-3">
      <p className="text-sm font-semibold text-zinc-900">{label}</p>
      <p className={name ? 'mt-1 text-sm text-zinc-700' : 'mt-1 text-sm italic text-zinc-400'}>
        {name ?? 'Not yet verified'}
      </p>
      <p className="mt-1 text-xs text-zinc-400">{provenanceLabel(field)}</p>
      {(phone || email || website) && (
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          {phone && <a href={`tel:${phone}`} className="rounded-full bg-zinc-100 px-2 py-1 font-medium text-zinc-700 hover:bg-zinc-200">{phone}</a>}
          {email && <a href={`mailto:${email}`} className="rounded-full bg-zinc-100 px-2 py-1 font-medium text-zinc-700 hover:bg-zinc-200">{email}</a>}
          {website && <a href={website} target="_blank" rel="noopener noreferrer" className="rounded-full bg-zinc-100 px-2 py-1 font-medium text-zinc-700 hover:bg-zinc-200">Website</a>}
        </div>
      )}
    </div>
  )
}

function RulesSection({ activeRuleSet }: { activeRuleSet: ActiveRuleSet }) {
  return (
    <div className="mt-6 border-t border-zinc-200 pt-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Rules and deadlines</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {activeRuleSet ? `${activeRuleSet.name} · effective ${formatDate(activeRuleSet.effectiveDate)}` : 'No active ruleset yet.'}
          </p>
        </div>
        {activeRuleSet && (
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            {activeRuleSet.rules.length} rules
          </span>
        )}
      </div>

      {activeRuleSet ? (
        <div className="mt-4 overflow-hidden rounded-lg border border-zinc-200">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-3">Deadline</th>
                <th className="px-4 py-3">Anchor</th>
                <th className="px-4 py-3">Offset</th>
                <th className="px-4 py-3">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 bg-white">
              {activeRuleSet.rules.map((rule) => (
                <tr key={rule.id}>
                  <td className="px-4 py-3 font-medium text-zinc-900">{rule.label}</td>
                  <td className="px-4 py-3 text-zinc-600">{rule.anchorField}</td>
                  <td className="px-4 py-3 text-zinc-600">{rule.offsetDays} days</td>
                  <td className="px-4 py-3 text-zinc-500">{rule.description ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-dashed border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Rules are not configured yet. Use the profile fields and official sources for manual research until an admin activates a ruleset.
        </div>
      )}
    </div>
  )
}
