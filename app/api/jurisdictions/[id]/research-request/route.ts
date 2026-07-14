import { NextResponse } from 'next/server'
import { syncUserToDatabase } from '@/lib/sync-user'
import { db } from '@/lib/db'
import { discoverJurisdictionSources, queueDiscoveredJurisdictionSources } from '@/lib/jurisdiction-source-adapters'

const CORE_OFFICE_TYPES = ['assessor', 'tax_collector', 'recorder', 'gis', 'planning_zoning', 'building']

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const synced = await syncUserToDatabase()
  if (!synced) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const jurisdiction = await db.jurisdiction.findUnique({ where: { id }, select: { id: true, state: true, county: true } })
  if (!jurisdiction) return NextResponse.json({ error: 'Jurisdiction not found' }, { status: 404 })

  const discovery = discoverJurisdictionSources({
    state: jurisdiction.state,
    county: jurisdiction.county,
    requestedOfficeTypes: CORE_OFFICE_TYPES,
  })

  const result = await db.$transaction(async tx => {
    const work = await tx.jurisdictionResearchWork.upsert({
      where: { jurisdictionId: id },
      create: { jurisdictionId: id, startedAt: new Date() },
      update: {},
      select: { id: true, status: true, requestedAt: true },
    })
    const demand = await tx.jurisdictionResearchDemand.upsert({
      where: { jurisdictionId_tenantId: { jurisdictionId: id, tenantId: synced.tenant.id } },
      create: { jurisdictionId: id, tenantId: synced.tenant.id, requestedBy: synced.user.id },
      update: {},
      select: { id: true, requestedAt: true },
    })
    let created = 0
    await queueDiscoveredJurisdictionSources({
      jurisdictionId: id,
      sources: discovery.sources,
      createLead: async lead => {
        const outcome = await tx.jurisdictionSourceDiscoveryLead.createMany({ data: lead, skipDuplicates: true })
        created += outcome.count
      },
    })
    return { work, demand, discovery: { status: discovery.status, leads: discovery.sources.length, created } }
  })
  return NextResponse.json(result, { status: 201 })
}
