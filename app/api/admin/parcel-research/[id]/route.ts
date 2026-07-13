import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { Prisma } from '@/app/generated/prisma'
import { isSuperAdmin } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import { sendEmail } from '@/lib/email'

const manualFieldsSchema = z.object({
  irsLienPresent: z.boolean().optional(),
  bankruptcyStay: z.boolean().optional(),
  waterAvailable: z.boolean().optional(),
  sewerAvailable: z.boolean().optional(),
  gasAvailable: z.boolean().optional(),
  quietTitleRequired: z.boolean().optional(),
  hoaPresent: z.boolean().optional(),
  hoaMonthlyFee: z.number().nonnegative().nullable().optional(),
  survivingLiens: z.array(z.string().min(1)).default([]),
  deedQuality: z.enum(['insurable', 'conditional', 'uninsurable']).optional(),
  conditionScore: z.number().min(0).max(100).nullable().optional(),
  topography: z.enum(['flat', 'sloped', 'hilly', 'wetland']).optional(),
  wetlandsAcres: z.number().nonnegative().nullable().optional(),
  notes: z.string().max(4000).optional(),
})

const updateSchema = z.object({
  status: z.enum(['IN_PROGRESS', 'COMPLETE']).default('COMPLETE'),
  fields: manualFieldsSchema,
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isSuperAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params

  const request = await db.parcelResearchRequest.findUnique({
    where: { id },
    include: {
      tenant: { select: { id: true, name: true } },
      deal: {
        select: {
          id: true,
          strategyType: true,
          property: {
            select: {
              apn: true,
              address: true,
              city: true,
              state: true,
              zip: true,
              jurisdiction: { select: { county: true, state: true } },
            },
          },
        },
      },
    },
  })
  if (!request) return NextResponse.json({ error: 'Research request not found' }, { status: 404 })

  const cacheRows = await db.parcelDataCache.findMany({
    where: {
      tenantId: request.tenantId,
      apnNormalized: request.apnNormalized,
      fipsCounty: request.fipsCounty,
      source: 'manual',
    },
    orderBy: { field: 'asc' },
  })

  return NextResponse.json({ request, cacheRows })
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isSuperAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const parsed = updateSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const existing = await db.parcelResearchRequest.findUnique({
    where: { id },
    include: {
      tenant: {
        select: {
          id: true,
          name: true,
          users: {
            where: { role: 'OWNER' },
            select: { email: true },
          },
        },
      },
      deal: {
        select: {
          id: true,
          property: {
            select: {
              apn: true,
              jurisdiction: { select: { county: true, state: true } },
            },
          },
        },
      },
    },
  })
  if (!existing) return NextResponse.json({ error: 'Research request not found' }, { status: 404 })

  const entries = manualCacheEntries(parsed.data.fields)
  const now = new Date()
  const neverExpires = new Date('9999-12-31T00:00:00.000Z')
  const { userId } = await auth()

  const updated = await db.$transaction(async tx => {
    for (const entry of entries) {
      await tx.parcelDataCache.upsert({
        where: {
          tenantId_apnNormalized_fipsCounty_source_field: {
            tenantId: existing.tenantId,
            apnNormalized: existing.apnNormalized,
            fipsCounty: existing.fipsCounty,
            source: 'manual',
            field: entry.field,
          },
        },
        update: {
          valueJson: entry.value,
          normalized: entry.value,
          retrievedAt: now,
          ttlHours: 0,
          expiresAt: neverExpires,
          metadata: entry.metadata,
        },
        create: {
          tenantId: existing.tenantId,
          apnNormalized: existing.apnNormalized,
          fipsCounty: existing.fipsCounty,
          source: 'manual',
          field: entry.field,
          valueJson: entry.value,
          normalized: entry.value,
          retrievedAt: now,
          ttlHours: 0,
          expiresAt: neverExpires,
          metadata: entry.metadata,
        },
      })
    }

    await tx.exitEvaluation.updateMany({
      where: { tenantId: existing.tenantId, dealId: existing.dealId },
      data: { expiresAt: now },
    })

    return tx.parcelResearchRequest.update({
      where: { id: existing.id },
      data: {
        status: parsed.data.status,
        startedAt: existing.startedAt ?? now,
        completedAt: parsed.data.status === 'COMPLETE' ? now : null,
        adminUserId: userId,
        notes: parsed.data.fields.notes,
        fieldsCompleted: entries.map(entry => entry.field),
      },
    })
  })

  if (parsed.data.status === 'COMPLETE') {
    await notifyTenantOwners(existing)
  }

  return NextResponse.json({ request: updated, fieldsCompleted: entries.map(entry => entry.field) })
}

function manualCacheEntries(fields: z.infer<typeof manualFieldsSchema>) {
  const entries: Array<{ field: string; value: Prisma.InputJsonValue; metadata: Prisma.InputJsonValue }> = []
  const add = (field: string, value: unknown) => {
    if (value === undefined || value === null || value === '') return
    if (Array.isArray(value) && value.length === 0) return
    entries.push({
      field,
      value: toJson(value),
      metadata: { source: 'admin_parcel_research' },
    })
  }

  add('irsLienPresent', fields.irsLienPresent)
  add('bankruptcyStay', fields.bankruptcyStay)
  add('waterAvailable', fields.waterAvailable)
  add('sewerAvailable', fields.sewerAvailable)
  add('gasAvailable', fields.gasAvailable)
  add('quietTitleRequired', fields.quietTitleRequired)
  add('survivingLiens', fields.survivingLiens)
  add('deedQuality', fields.deedQuality)
  add('conditionScore', fields.conditionScore)
  add('topography', fields.topography)
  add('wetlandsAcres', fields.wetlandsAcres)

  if (fields.hoaPresent !== undefined || fields.hoaMonthlyFee != null) {
    add('hoa', {
      present: fields.hoaPresent ?? fields.hoaMonthlyFee != null,
      ...(fields.hoaMonthlyFee == null ? {} : { monthlyFee: fields.hoaMonthlyFee }),
    })
  }

  return entries
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

async function notifyTenantOwners(request: {
  tenant: { name: string; users: Array<{ email: string }> }
  deal: { id: string; property: { apn: string; jurisdiction: { county: string; state: string } } }
}) {
  if (!process.env.RESEND_API_KEY) return
  const recipients = request.tenant.users.map(user => user.email).filter(Boolean)
  if (recipients.length === 0) return

  await sendEmail({
    from: process.env.EMAIL_FROM ?? 'noreply@metisplatforms.com',
    to: recipients,
    subject: `Parcel research complete for APN ${request.deal.property.apn}`,
    html: [
      '<div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px">',
      `<p>Parcel research is complete for <strong>${escapeHtml(request.deal.property.apn)}</strong> in ${escapeHtml(request.deal.property.jurisdiction.county)}, ${escapeHtml(request.deal.property.jurisdiction.state)}.</p>`,
      `<p><a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://metisplatforms.com'}/dashboard/deals/${request.deal.id}">Open the deal in Metis</a> to re-run exit analysis with the new data.</p>`,
      '</div>',
    ].join(''),
  })
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}
