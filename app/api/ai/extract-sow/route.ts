import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { getAnthropic, resolveAnthropicKey } from '@/lib/ai'
import { getDownloadUrl } from '@/lib/r2'
import type Anthropic from '@anthropic-ai/sdk'

const SETTINGS_URL = '/dashboard/settings/ai'

const SOW_PROMPT = `You are extracting line items from a contractor bid or invoice document for a fix-and-flip real estate project.

Extract each line item and return ONLY valid JSON with no additional text.

For each line item extract:
- category: the trade category (use one of: Foundation/Structure, Roofing, Electrical, Plumbing, HVAC, Windows/Doors, Framing/Drywall, Flooring, Kitchen, Bathrooms, Painting/Finishes, Landscaping/Exterior, Other)
- description: brief description of the work item
- amount: dollar amount as a number (no $ sign, no commas)

Return exactly:
{"items":[{"category":"Roofing","description":"Remove and replace shingles","amount":8500},{"category":"Electrical","description":"Panel upgrade to 200A","amount":3200}]}

If no line items can be extracted, return {"items":[]}.`

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

  if (doc.docType !== 'CONTRACTOR_BID' && doc.docType !== 'INVOICE') {
    return NextResponse.json({ error: 'SOW extraction only supports Contractor Bids and Invoices' }, { status: 422 })
  }

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

  try {
    const anthropic = getAnthropic(apiKey)
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [{ role: 'user', content: [fileBlock, { type: 'text', text: SOW_PROMPT }] }],
    })

    const text = message.content.find(b => b.type === 'text')?.text ?? ''
    const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    const result = JSON.parse(cleaned) as { items: { category: string; description: string; amount: number }[] }

    return NextResponse.json(result)
  } catch (err) {
    console.error('[ai/extract-sow]', err)
    return NextResponse.json({ error: `Extraction failed: ${err instanceof Error ? err.message : 'unknown error'}` }, { status: 500 })
  }
}
