import { NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { isSuperAdmin } from '@/lib/admin-auth'
import { db } from '@/lib/db'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (!(await isSuperAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const candidate = await db.extractionCandidate.findUnique({ where: { id } })
  if (!candidate) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (candidate.status !== 'PENDING') {
    return NextResponse.json({ error: 'Candidate is not pending' }, { status: 409 })
  }

  const user = await currentUser()
  const reviewerEmail = user?.emailAddresses.find(e => e.id === user.primaryEmailAddressId)
    ?.emailAddress ?? 'admin'

  const updated = await db.extractionCandidate.update({
    where: { id },
    data: { status: 'REJECTED', reviewedAt: new Date(), reviewedBy: reviewerEmail },
  })

  return NextResponse.json(updated)
}
