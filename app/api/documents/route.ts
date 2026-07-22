import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { syncUserToDatabase } from '@/lib/sync-user'
import { db } from '@/lib/db'
import { requestIdFromHeaders } from '@/lib/request-correlation'

const BodySchema = z.object({
  dealId:   z.string(),
  fileName: z.string().max(255),
  fileSize: z.number().int().positive(),
  mimeType: z.string(),
  r2Key:    z.string(),
  docType:  z.enum([
    'LIEN_CERTIFICATE', 'TAX_DEED', 'PURCHASE_CONTRACT', 'NOTICE_LETTER',
    'USPS_RECEIPT', 'COURT_FILING', 'TITLE_REPORT', 'DEED', 'LEASE', 'OTHER',
  ]),
})

export async function POST(req: NextRequest) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const synced = await syncUserToDatabase()
  if (!synced) return NextResponse.json({ error: 'Tenant not found' }, { status: 403 })
  const { tenant } = synced

  const body = await req.json()
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { dealId, fileName, fileSize, mimeType, r2Key, docType } = parsed.data

  // Verify the deal belongs to this tenant
  const deal = await db.deal.findUnique({ where: { id: dealId } })
  if (!deal || deal.tenantId !== tenant.id) {
    return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
  }

  // Verify the r2Key is prefixed with this tenant (prevents cross-tenant key injection)
  if (!r2Key.startsWith(`tenants/${tenant.id}/`)) {
    return NextResponse.json({ error: 'Invalid key' }, { status: 400 })
  }

  const doc = await db.$transaction(async transaction => {
    const created = await transaction.document.create({
      data: { tenantId: tenant.id, dealId, fileName, fileSize, mimeType, r2Key, docType },
    })
    await transaction.auditEvent.create({
      data: {
        tenantId: tenant.id,
        userId: synced.user.id,
        requestId: requestIdFromHeaders(req.headers),
        action: 'DOCUMENT_CREATED',
        // Document metadata can expose investor information; retain identity only.
        meta: { documentId: created.id, dealId },
      },
    })
    return created
  })

  return NextResponse.json(doc, { status: 201 })
}
