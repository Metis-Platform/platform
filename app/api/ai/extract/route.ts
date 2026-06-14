import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { getAnthropic, resolveAnthropicKey } from '@/lib/ai'
import { getDownloadUrl } from '@/lib/r2'
import type Anthropic from '@anthropic-ai/sdk'

const SETTINGS_URL = '/dashboard/settings/ai'

const TAX_LIEN_PROMPT = `You are extracting structured data from a tax lien certificate document.
Extract the following fields and return ONLY valid JSON with no additional text.

Fields:
- certificateNumber: certificate/lien number (string)
- apn: assessor's parcel number (string)
- faceAmount: face/principal amount in USD as a number (no $ sign)
- interestRate: annual interest rate as a percentage number (e.g. 18 for 18%)
- issueDate: issue date in YYYY-MM-DD format (string)
- state: US state abbreviation (string)
- county: county name without "County" suffix (string)
- ownerName: property owner name (string)

Return exactly:
{"fields":{"certificateNumber":{"value":"...","confidence":0.9},"apn":{"value":"...","confidence":0.9},"faceAmount":{"value":1234.56,"confidence":0.9},"interestRate":{"value":18,"confidence":0.9},"issueDate":{"value":"2024-01-15","confidence":0.9},"state":{"value":"FL","confidence":0.9},"county":{"value":"Orange","confidence":0.9},"ownerName":{"value":"John Doe","confidence":0.9}}}

confidence is 0.0–1.0. If a field cannot be found, set value to null and confidence to 0.`

const TAX_DEED_PROMPT = `You are extracting structured data from a tax deed document.
Extract the following fields and return ONLY valid JSON with no additional text.

Fields:
- apn: assessor's parcel number (string)
- saleDate: tax deed sale date in YYYY-MM-DD format (string)
- winningBid: winning bid amount in USD as a number (no $ sign)
- openingBid: opening/minimum bid in USD as a number (no $ sign)
- state: US state abbreviation (string)
- county: county name without "County" suffix (string)
- grantorName: grantor / county issuing the deed (string)

Return exactly:
{"fields":{"apn":{"value":"...","confidence":0.9},"saleDate":{"value":"2024-01-15","confidence":0.9},"winningBid":{"value":5000.00,"confidence":0.9},"openingBid":{"value":3000.00,"confidence":0.9},"state":{"value":"FL","confidence":0.9},"county":{"value":"Orange","confidence":0.9},"grantorName":{"value":"Orange County BCC","confidence":0.9}}}

confidence is 0.0–1.0. If a field cannot be found, set value to null and confidence to 0.`

const SUPPORTED_MIMES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif'])

export async function POST(req: NextRequest) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenant = await db.tenant.findUnique({ where: { clerkOrgId: orgId }, select: { id: true } })
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  let apiKey: string
  try {
    apiKey = await resolveAnthropicKey(tenant.id)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Add your Anthropic API key in Settings', settingsUrl: SETTINGS_URL },
      { status: 402 },
    )
  }

  const body = await req.json().catch(() => ({})) as { documentId?: string }
  if (!body.documentId) return NextResponse.json({ error: 'documentId is required' }, { status: 400 })

  const doc = await db.document.findUnique({
    where: { id: body.documentId, tenantId: tenant.id },
  })
  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

  if (doc.docType !== 'LIEN_CERTIFICATE' && doc.docType !== 'TAX_DEED') {
    return NextResponse.json({ error: 'Extraction only supports Lien Certificates and Tax Deeds' }, { status: 422 })
  }

  // Return cache if already extracted
  if (doc.extractedData) return NextResponse.json(doc.extractedData)

  if (!SUPPORTED_MIMES.has(doc.mimeType)) {
    return NextResponse.json(
      { error: `File type "${doc.mimeType}" is not supported. Upload a PDF or image.` },
      { status: 422 },
    )
  }

  const downloadUrl = await getDownloadUrl(doc.r2Key, doc.fileName)
  const fileRes = await fetch(downloadUrl)
  if (!fileRes.ok) return NextResponse.json({ error: 'Failed to fetch document from storage' }, { status: 500 })
  const base64 = Buffer.from(await fileRes.arrayBuffer()).toString('base64')

  const isImage = doc.mimeType.startsWith('image/')
  const mediaType = doc.mimeType as Anthropic.Base64ImageSource['media_type'] | 'application/pdf'

  const fileBlock: Anthropic.MessageParam['content'][0] = isImage
    ? {
        type: 'image',
        source: { type: 'base64', media_type: mediaType as Anthropic.Base64ImageSource['media_type'], data: base64 },
      }
    : {
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: base64 },
      }

  const prompt = doc.docType === 'LIEN_CERTIFICATE' ? TAX_LIEN_PROMPT : TAX_DEED_PROMPT

  let result: unknown
  try {
    const anthropic = getAnthropic(apiKey)
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: [fileBlock, { type: 'text', text: prompt }] }],
    })

    const text = message.content.find(b => b.type === 'text')?.text ?? ''
    const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    result = JSON.parse(cleaned)
  } catch (err) {
    console.error('[ai/extract]', err)
    return NextResponse.json({ error: `Extraction failed: ${err instanceof Error ? err.message : 'unknown error'}` }, { status: 500 })
  }

  await db.document.update({
    where: { id: doc.id },
    data: { extractedData: result as object },
  })

  return NextResponse.json(result)
}
