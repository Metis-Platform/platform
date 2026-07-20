import { NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { z } from 'zod'
import { isSuperAdmin } from '@/lib/admin-auth'
import { publishUnincorporatedAuthorityBoundary } from '@/lib/jurisdiction-authority-boundary'
import { isPolygonGeometry } from '@/lib/geo/types'

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

  try {
    const { id } = await params
    const result = await publishUnincorporatedAuthorityBoundary({
      jurisdictionId: id,
      reviewerId: user.id,
      ...parsed.data,
    })
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    const code = error instanceof Error ? error.message : 'BOUNDARY_PUBLICATION_FAILED'
    return NextResponse.json({ error: code }, { status: 409 })
  }
}
