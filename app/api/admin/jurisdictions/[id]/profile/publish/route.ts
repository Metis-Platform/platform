import { NextResponse } from 'next/server'
import { z } from 'zod'
import { type JurisdictionProfile } from '@/app/generated/prisma'
import { isSuperAdmin } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import {
  isJurisdictionProfileSection,
  type JurisdictionProfileSection,
} from '@/lib/jurisdiction-profile'

const publishSchema = z.object({
  section: z.string().refine(isJurisdictionProfileSection),
})

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isSuperAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await req.json()
  const parsed = publishSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const section = parsed.data.section as JurisdictionProfileSection
  const [updated] = await db.$queryRaw<JurisdictionProfile[]>`
    UPDATE "JurisdictionProfile"
    SET "publishedSections" = CASE
      WHEN ${section} = ANY("publishedSections") THEN "publishedSections"
      ELSE array_append("publishedSections", ${section})
    END,
    "updatedAt" = NOW()
    WHERE "jurisdictionId" = ${id}
    RETURNING *
  `

  if (!updated) return NextResponse.json({ error: 'Jurisdiction profile not found' }, { status: 404 })

  return NextResponse.json(updated)
}
