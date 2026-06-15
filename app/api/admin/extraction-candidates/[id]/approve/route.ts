import { NextResponse } from 'next/server'
import { Prisma } from '@/app/generated/prisma'
import { currentUser } from '@clerk/nextjs/server'
import { isSuperAdmin } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import { isJurisdictionProfileSection } from '@/lib/jurisdiction-profile'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (!(await isSuperAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const candidate = await db.extractionCandidate.findUnique({
    where: { id },
    include: { jurisdiction: { select: { county: true, state: true } } },
  })
  if (!candidate) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (candidate.status !== 'PENDING') {
    return NextResponse.json({ error: 'Candidate is not pending' }, { status: 409 })
  }

  if (!isJurisdictionProfileSection(candidate.section)) {
    return NextResponse.json({ error: 'Invalid profile section' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({})) as { value?: unknown }

  // If the reviewer edited the value, merge it into the extracted field
  const extractedValue = candidate.extractedValue as Record<string, unknown>
  const fieldToWrite = body.value !== undefined
    ? { ...extractedValue, value: body.value }
    : extractedValue

  // Ensure profile exists
  await db.jurisdictionProfile.upsert({
    where: { jurisdictionId: candidate.jurisdictionId },
    update: {},
    create: { jurisdictionId: candidate.jurisdictionId },
  })

  // Write field to JurisdictionProfile using jsonb_set
  const section = candidate.section
  const fieldKey = candidate.fieldKey
  await db.$queryRaw`
    UPDATE "JurisdictionProfile"
    SET ${Prisma.raw(`"${section}"`)} = jsonb_set(
      COALESCE(${Prisma.raw(`"${section}"`)}, '{}'::jsonb),
      ARRAY[${fieldKey}],
      ${JSON.stringify(fieldToWrite)}::jsonb,
      true
    ),
    "updatedAt" = NOW()
    WHERE "jurisdictionId" = ${candidate.jurisdictionId}
  `

  const user = await currentUser()
  const reviewerEmail = user?.emailAddresses.find(e => e.id === user.primaryEmailAddressId)
    ?.emailAddress ?? 'admin'

  const updated = await db.extractionCandidate.update({
    where: { id },
    data: {
      status: 'APPROVED',
      reviewedAt: new Date(),
      reviewedBy: reviewerEmail,
      extractedValue: fieldToWrite as object,
    },
  })

  return NextResponse.json(updated)
}
