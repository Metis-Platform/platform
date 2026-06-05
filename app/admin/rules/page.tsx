import { db } from '@/lib/db'
import JurisdictionSearch from './JurisdictionSearch'

export const dynamic = 'force-dynamic'

export default async function AdminRulesPage() {
  const jurisdictions = await db.jurisdiction.findMany({
    orderBy: [{ state: 'asc' }, { county: 'asc' }],
    select: {
      id: true,
      state: true,
      stateName: true,
      county: true,
      investmentType: true,
      isAvailable: true,
      ruleSets: {
        select: {
          id: true,
          name: true,
          isActive: true,
          _count: { select: { rules: true } },
        },
      },
    },
  })

  const rows = jurisdictions.map((j) => {
    const active = j.ruleSets.find((r) => r.isActive) ?? null
    return {
      id: j.id,
      state: j.state,
      stateName: j.stateName,
      county: j.county,
      investmentType: j.investmentType as string,
      isAvailable: j.isAvailable,
      activeRuleSet: active
        ? { id: active.id, name: active.name, ruleCount: active._count.rules }
        : null,
      totalRuleSets: j.ruleSets.length,
    }
  })

  const withRules = rows.filter((r) => r.activeRuleSet).length

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Jurisdiction Rules</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {jurisdictions.length} jurisdictions ·{' '}
          <span className="text-green-700 font-medium">{withRules} with active rules</span> ·{' '}
          <span className="text-amber-700 font-medium">
            {jurisdictions.length - withRules} missing rules
          </span>
        </p>
      </div>

      <JurisdictionSearch jurisdictions={rows} />
    </div>
  )
}
