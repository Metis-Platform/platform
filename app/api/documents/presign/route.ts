import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { syncUserToDatabase } from '@/lib/sync-user'
import { getUploadUrl } from '@/lib/r2'

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',       // xlsx
  'text/plain',
  'text/csv',
])

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

const BodySchema = z.object({
  dealId:   z.string(),
  fileName: z.string().max(255),
  fileSize: z.number().int().positive().max(MAX_FILE_SIZE, 'File must be under 10 MB'),
  mimeType: z.string(),
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

  const { dealId, fileName, mimeType, docType } = parsed.data

  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return NextResponse.json({ error: 'File type not supported' }, { status: 400 })
  }

  // Sanitise the file extension from the original name
  const ext = fileName.split('.').pop()?.toLowerCase() ?? 'bin'
  const r2Key = `tenants/${tenant.id}/deals/${dealId}/${randomUUID()}.${ext}`

  const uploadUrl = await getUploadUrl(r2Key, mimeType)

  return NextResponse.json({ uploadUrl, r2Key, docType })
}
