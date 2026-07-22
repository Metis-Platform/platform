import { redirect } from 'next/navigation'
import { isSuperAdmin } from '@/lib/admin-auth'
import {
  featureVerificationCatalog,
  summarizeFeatureVerificationCatalog,
} from '@/lib/feature-verification-catalog'

export default async function FeatureVerificationPage() {
  if (!(await isSuperAdmin())) redirect('/')

  const { stories } = featureVerificationCatalog()
  const summary = summarizeFeatureVerificationCatalog()

  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Feature Verification</h1>
        <p className="mt-1 text-sm text-zinc-500">Read-only click/save evidence contracts enforced by CI. A blocked journey has not been executed in hosted QA.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Metric label="Declared stories" value={summary.total} />
        <Metric label="Active now" value={summary.active} />
        <Metric label="Mutation journeys" value={summary.mutation} />
        <Metric label="Awaiting QA" value={summary.blocked} tone="amber" />
        <Metric label="Critical risk" value={summary.critical} tone="red" />
      </div>

      <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Hosted mutation evidence remains blocked until the isolated, reset-safe QA environment is authorized. This page describes the contract; it does not claim the blocked journeys have run.
      </p>

      <div className="space-y-4">
        {stories.map(story => (
          <section key={story.id} className="rounded-xl border border-zinc-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-zinc-900">{story.id}</h2>
                <p className="mt-1 text-sm text-zinc-500">{story.notes}</p>
              </div>
              <div className="flex gap-2 text-xs font-medium">
                <Badge value={story.risk} tone={story.risk === 'critical' ? 'red' : story.risk === 'high' ? 'amber' : 'zinc'} />
                <Badge value={story.mode} tone={story.mode === 'mutation' ? 'blue' : 'zinc'} />
                <Badge value={story.status} tone={story.status.startsWith('blocked') ? 'amber' : 'green'} />
              </div>
            </div>
            <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <Detail label="Playwright spec" value={story.spec} />
              {story.journey && <Detail label="Entry point" value={story.journey.entryPoint} />}
              {story.evidence && <Detail label="Fixture set" value={story.evidence.fixtureSet} />}
              {story.evidence && <Detail label="Response evidence" value={`${story.evidence.responseHeader} → ${story.evidence.auditAction}`} />}
              {story.journey && <Detail label="Persisted outcome" value={story.journey.persistedOutcome} />}
              {story.journey && <Detail label="Cleanup" value={story.journey.cleanup} />}
            </dl>
            {story.journey && <div className="mt-4 rounded-lg bg-zinc-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">User actions</p>
              <ol className="mt-2 space-y-2 text-sm text-zinc-700">
                {story.journey.actions.map((action, index) => <li key={`${action.userAction}-${index}`}>
                  <span className="font-medium">{index + 1}. {action.userAction}</span>
                  <span className="block text-zinc-500">Expected request: {action.expectedRequest}</span>
                </li>)}
              </ol>
            </div>}
          </section>
        ))}
      </div>
    </div>
  )
}

function Metric({ label, value, tone = 'zinc' }: { label: string; value: number; tone?: 'zinc' | 'amber' | 'red' }) {
  const color = tone === 'amber' ? 'text-amber-700' : tone === 'red' ? 'text-red-700' : 'text-zinc-900'
  return <div className="rounded-xl border border-zinc-200 bg-white p-4"><p className="text-xs font-medium uppercase text-zinc-500">{label}</p><p className={`mt-2 text-2xl font-bold ${color}`}>{value}</p></div>
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-medium uppercase tracking-wide text-zinc-400">{label}</dt><dd className="mt-1 whitespace-pre-wrap text-zinc-700">{value}</dd></div>
}

function Badge({ value, tone }: { value: string; tone: 'zinc' | 'blue' | 'amber' | 'red' | 'green' }) {
  const colors = {
    zinc: 'bg-zinc-100 text-zinc-700', blue: 'bg-blue-100 text-blue-700', amber: 'bg-amber-100 text-amber-800', red: 'bg-red-100 text-red-700', green: 'bg-emerald-100 text-emerald-700',
  }
  return <span className={`rounded-full px-2 py-1 ${colors[tone]}`}>{value}</span>
}
