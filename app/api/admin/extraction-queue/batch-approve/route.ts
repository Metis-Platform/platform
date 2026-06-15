import { NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@/app/generated/prisma'
import { currentUser } from '@clerk/nextjs/server'
import { isSuperAdmin } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import { isJurisdictionProfileSection } from '@/lib/jurisdiction-profile'

const schema = z.object({
  minConfidence: z.number().min(0).max(1).default(0.85),
  section: z.string().optional(),
})

export async function POST(req: Request): Promise<NextResponse> {
  if (!(await isSuperAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const { minConfidence, section } = parsed.data

  const pending = await db.extractionCandidate.findMany({
    where: {
      status: 'PENDING',
      confidence: { gte: minConfidence },
      ...(section ? { section } : {}),
    },
    take: 500,
  })

  const user = await currentUser()
  const reviewerEmail = user?.emailAddresses.find(e => e.id === user.primaryEmailAddressId)
    ?.emailAddress ?? 'admin'

  let approved = 0
  let errors = 0

  for (const candidate of pending) {
    if (!isJurisdictionProfileSection(candidate.section)) { errors++; continue }

    const fieldKey = candidate.fieldKey
    const sectionKey = candidate.section
    const fieldValue = candidate.extractedValue as Record<string, unknown>

    try {
      await db.jurisdictionProfile.upsert({
        where: { jurisdictionId: candidate.jurisdictionId },
        update: {},
        create: { jurisdictionId: candidate.jurisdictionId },
      })

      await db.$queryRaw`
        UPDATE "JurisdictionProfile"
        SET ${Prisma.raw(`"${sectionKey}"`)} = jsonb_set(
          COALESCE(${Prisma.raw(`"${sectionKey}"`)}, '{}'::jsonb),
          ARRAY[${fieldKey}],
          ${JSON.stringify(fieldValue)}::jsonb,
          true
        ),
        "updatedAt" = NOW()
        WHERE "jurisdictionId" = ${candidate.jurisdictionId}
      `

      await db.extractionCandidate.update({
        where: { id: candidate.id },
        data: { status: 'APPROVED', reviewedAt: new Date(), reviewedBy: reviewerEmail },
      })
      approved++
    } catch {
      errors++
    }
  }

  return NextResponse.json({ approved, errors, total: pending.length })
}
