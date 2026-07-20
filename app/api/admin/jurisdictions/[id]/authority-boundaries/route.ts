import { NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { z } from 'zod'
import { isSuperAdmin } from '@/lib/admin-auth'
import { publishUnincorporatedAuthorityBoundary } from '@/lib/jurisdiction-authority-boundary'
import { isPolygonGeometry } from '@/lib/geo/types'
import { requestIdFromHeaders } from '@/lib/request-correlation'
import { syncUserToDatabase } from '@/lib/sync-user'

const schema = z.object({
  claimId: z.string().uuid(),
  geometry: z.unknown().refine(isPolygonGeometry),
  replacesBoundaryId: z.string().uuid().optional(),
}).strict()

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isSuperAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  const user = await currentUser()
  if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const actor = await syncUserToDatabase()
  if (!actor) return NextResponse.json({ error: 'Active organization required' }, { status: 401 })

  try {
    const { id } = await params
    const result = await publishUnincorporatedAuthorityBoundary({
      jurisdictionId: id,
      reviewerId: user.id,
      ...parsed.data,
      auditEvent: {
        tenantId: actor.tenant.id,
        userId: actor.user.id,
        requestId: requestIdFromHeaders(req.headers),
        action: 'JURISDICTION_AUTHORITY_BOUNDARY_PUBLISHED',
        meta: {
          jurisdictionId: id,
          claimId: parsed.data.claimId,
          replacesBoundaryId: parsed.data.replacesBoundaryId ?? null,
        },
      },
    })
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    const code = error instanceof Error ? error.message : 'BOUNDARY_PUBLICATION_FAILED'
    return NextResponse.json({ error: code }, { status: 409 })
  }
}
