import { NextResponse } from 'next/server'
import { z } from 'zod'
import { isSuperAdmin } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import { discoverJurisdictionSources, queueDiscoveredJurisdictionSources } from '@/lib/jurisdiction-source-adapters'

const officeTypes = z.enum(['assessor', 'tax_collector', 'recorder', 'gis', 'planning_zoning', 'building'])
const schema = z.object({ officeTypes: z.array(officeTypes).min(1).max(6).optional() })

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isSuperAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const parsed = schema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { id } = await params
  const jurisdiction = await db.jurisdiction.findUnique({ where: { id }, select: { state: true } })
  if (!jurisdiction) return NextResponse.json({ error: 'Jurisdiction not found' }, { status: 404 })

  const discovery = discoverJurisdictionSources({
    state: jurisdiction.state,
    requestedOfficeTypes: parsed.data.officeTypes ?? officeTypes.options,
  })
  let created = 0
  await queueDiscoveredJurisdictionSources({
    jurisdictionId: id,
    sources: discovery.sources,
    createLead: async lead => {
      const result = await db.jurisdictionSourceDiscoveryLead.createMany({ data: lead, skipDuplicates: true })
      created += result.count
    },
  })
  return NextResponse.json({ status: discovery.status, leads: discovery.sources.length, created })
}
