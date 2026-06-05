import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import RulesClient from './RulesClient'

export const dynamic = 'force-dynamic'

const INVESTMENT_LABELS: Record<string, string> = {
  LIEN: 'Tax Lien',
  DEED: 'Tax Deed',
  REDEEMABLE_DEED: 'Redeemable Deed',
}

export default async function JurisdictionRulesPage({
  params,
}: {
  params: Promise<{ jurisdictionId: string }>
}) {
  const { jurisdictionId } = await params

  const jurisdiction = await db.jurisdiction.findUnique({
    where: { id: jurisdictionId },
    include: {
      ruleSets: {
        orderBy: [{ isActive: 'desc' }, { effectiveDate: 'desc' }],
        include: {
          rules: { orderBy: [{ sortOrder: 'asc' }, { offsetDays: 'asc' }] },
        },
      },
    },
  })

  if (!jurisdiction) notFound()

  // How many other counties in the same state have no active ruleset
  const stateMissingCount = await db.jurisdiction.count({
    where: {
      state: jurisdiction.state,
      id: { not: jurisdictionId },
      ruleSets: { none: { isActive: true } },
    },
  })

  const ruleSets = jurisdiction.ruleSets.map((rs) => ({
    id: rs.id,
    name: rs.name,
    effectiveDate: rs.effectiveDate.toISOString().slice(0, 10),
    isActive: rs.isActive,
    rules: rs.rules.map((r) => ({
      id: r.id,
      eventType: r.eventType as string,
      label: r.label,
      anchorField: r.anchorField,
      offsetDays: r.offsetDays,
      sortOrder: r.sortOrder,
      description: r.description,
    })),
  }))

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-zinc-500">
        <Link href="/admin/rules" className="hover:text-zinc-900">
          Jurisdictions
        </Link>
        <span>/</span>
        <span className="text-zinc-900">
          {jurisdiction.county}, {jurisdiction.state}
        </span>
      </nav>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">
          {jurisdiction.county} County, {jurisdiction.stateName}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {INVESTMENT_LABELS[jurisdiction.investmentType] ?? jurisdiction.investmentType} ·{' '}
          {jurisdiction.timezone}
          {jurisdiction.notes && (
            <>
              {' '}· <span className="italic">{jurisdiction.notes}</span>
            </>
          )}
        </p>
      </div>

      {/* Ruleset editor */}
      <RulesClient
        jurisdictionId={jurisdictionId}
        stateName={jurisdiction.stateName}
        stateMissingCount={stateMissingCount}
        ruleSets={ruleSets}
      />
    </div>
  )
}
