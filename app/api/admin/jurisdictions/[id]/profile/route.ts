import { NextResponse } from 'next/server'
import { z } from 'zod'
import { currentUser } from '@clerk/nextjs/server'
import { isSuperAdmin } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import {
  isJurisdictionProfileSection,
  type JurisdictionProfileSection,
} from '@/lib/jurisdiction-profile'
import { publishJurisdictionClaim } from '@/lib/jurisdiction-claim-publication'
import { evaluateJurisdictionPublication } from '@/lib/jurisdiction-publication-policy'

const profileFieldSchema = z.object({
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.record(z.string(), z.unknown())]),
  sourceUrl: z.string().url().optional(),
  citation: z.string().optional(),
  // Accepted for backwards-compatible clients, but the server replaces it with review time.
  verifiedAt: z.string().datetime().optional(),
  confidence: z.number().min(0).max(1),
  verifiedById: z.string().optional(),
  volatility: z.enum(['static', 'annual', 'per_sale', 'quarterly']),
  normalizedUnit: z.string().optional(),
  geographicScope: z.string().optional(),
  effectiveAt: z.string().datetime().optional(),
})

const patchSchema = z.object({
  section: z.string().refine(isJurisdictionProfileSection),
  fieldKey: z.string().min(1),
  field: profileFieldSchema,
})

async function ensureJurisdictionProfile(jurisdictionId: string) {
  const jurisdiction = await db.jurisdiction.findUnique({
    where: { id: jurisdictionId },
    select: { id: true },
  })

  if (!jurisdiction) return null

  return db.jurisdictionProfile.upsert({
    where: { jurisdictionId },
    update: {},
    create: { jurisdictionId },
  })
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isSuperAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const profile = await ensureJurisdictionProfile(id)
  if (!profile) return NextResponse.json({ error: 'Jurisdiction not found' }, { status: 404 })

  return NextResponse.json(profile)
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isSuperAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const profile = await ensureJurisdictionProfile(id)
  if (!profile) return NextResponse.json({ error: 'Jurisdiction not found' }, { status: 404 })

  const section = parsed.data.section as JurisdictionProfileSection
  const user = await currentUser()
  const reviewerId = user?.id ?? ''
  const reviewerLabel = user?.emailAddresses.find(e => e.id === user.primaryEmailAddressId)
    ?.emailAddress ?? reviewerId
  const decision = evaluateJurisdictionPublication({
    section,
    fieldKey: parsed.data.fieldKey,
    mode: 'HUMAN_SINGLE',
    evidence: {
      sourceUrl: parsed.data.field.sourceUrl,
      sourceSnippet: parsed.data.field.citation,
      reviewerId,
    },
  })
  if (!decision.allowed) {
    return NextResponse.json({ error: decision.code }, { status: 422 })
  }
  let result: Awaited<ReturnType<typeof publishJurisdictionClaim>>
  try {
    result = await publishJurisdictionClaim({
      jurisdictionId: id,
      section,
      fieldKey: parsed.data.fieldKey,
      extractedValue: parsed.data.field,
      question: decision.question,
      reviewerId,
      reviewerLabel,
      source: {
        url: parsed.data.field.sourceUrl!,
        snippet: parsed.data.field.citation!,
        retrievedAt: new Date(),
        authorityStatus: 'UNVERIFIED',
      },
    })
  } catch (error) {
    const code = error instanceof Error ? error.message : 'PUBLICATION_FAILED'
    return NextResponse.json({ error: code }, { status: 409 })
  }

  return NextResponse.json({ ok: true, claimId: result.claimId, field: result.profileField })
}
