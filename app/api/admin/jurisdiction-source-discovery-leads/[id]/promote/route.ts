import { currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { isSuperAdmin } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import { sourceDiscoveryPromotionSchema } from '@/lib/jurisdiction-source-promotion'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isSuperAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const parsed = sourceDiscoveryPromotionSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const user = await currentUser()
  if (!user?.id) return NextResponse.json({ error: 'Reviewer identity unavailable' }, { status: 401 })

  const { id } = await params
  try {
    const result = await db.$transaction(async tx => {
      const lead = await tx.jurisdictionSourceDiscoveryLead.findUnique({ where: { id } })
      if (!lead) throw new Error('LEAD_NOT_FOUND')
      if (lead.status !== 'PENDING_REVIEW') throw new Error('LEAD_NOT_PENDING')
      if (lead.updatedAt.getTime() !== parsed.data.expectedUpdatedAt.getTime()) throw new Error('STALE_LEAD')

      const existing = await tx.jurisdictionSourceUrl.findUnique({
        where: { jurisdictionId_officeType_url: { jurisdictionId: lead.jurisdictionId, officeType: lead.officeType, url: parsed.data.sourceUrl } },
      })
      const source = existing ?? await tx.jurisdictionSourceUrl.create({ data: {
        jurisdictionId: lead.jurisdictionId, officeType: lead.officeType, url: parsed.data.sourceUrl,
      } })
      const updated = await tx.jurisdictionSourceDiscoveryLead.updateMany({
        where: { id: lead.id, status: 'PENDING_REVIEW', updatedAt: lead.updatedAt },
        data: { status: 'PROMOTED', promotedSourceUrlId: source.id, promotedAt: new Date(), promotedBy: user.id },
      })
      if (updated.count !== 1) throw new Error('STALE_LEAD')
      return { leadId: lead.id, sourceId: source.id, sourceWasExisting: Boolean(existing) }
    })
    return NextResponse.json({ ok: true, ...result, authorityStatus: 'UNVERIFIED' })
  } catch (error) {
    const code = error instanceof Error ? error.message : 'PROMOTION_FAILED'
    if (code === 'LEAD_NOT_FOUND') return NextResponse.json({ error: code }, { status: 404 })
    if (code === 'LEAD_NOT_PENDING' || code === 'STALE_LEAD') return NextResponse.json({ error: code }, { status: 409 })
    return NextResponse.json({ error: 'PROMOTION_FAILED' }, { status: 500 })
  }
}
