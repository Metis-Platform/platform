import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { getAnthropic, resolveAnthropicKey } from '@/lib/ai'
import { getDownloadUrl } from '@/lib/r2'
import type Anthropic from '@anthropic-ai/sdk'

const SETTINGS_URL = '/dashboard/settings/ai'

const MF_PROMPT = `You are extracting underwriting data from a multifamily real estate offering memorandum (OM) or investment package.

Extract the following fields and return ONLY valid JSON with no additional text.

Fields:
- unitCount: total number of units (integer)
- askingPrice: asking/listing price in USD as a number (no $ sign, no commas)
- grossScheduledIncome: gross scheduled income (GSI) annual amount in USD as a number
- vacancyRate: vacancy rate as a decimal (e.g. 0.05 for 5%)
- operatingExpenses: total annual operating expenses in USD as a number
- netOperatingIncome: NOI annual amount in USD as a number
- capRate: cap rate as a decimal (e.g. 0.065 for 6.5%)
- loanAmount: stated loan amount if mentioned in USD as a number (null if not stated)
- interestRate: interest rate as a decimal if mentioned (e.g. 0.065 for 6.5%) (null if not stated)
- loanTermYears: loan term in years if stated (null if not stated)

Return exactly:
{"fields":{"unitCount":{"value":24,"confidence":0.9},"askingPrice":{"value":2400000,"confidence":0.9},"grossScheduledIncome":{"value":288000,"confidence":0.9},"vacancyRate":{"value":0.05,"confidence":0.8},"operatingExpenses":{"value":96000,"confidence":0.9},"netOperatingIncome":{"value":177600,"confidence":0.9},"capRate":{"value":0.074,"confidence":0.9},"loanAmount":{"value":null,"confidence":0},"interestRate":{"value":null,"confidence":0},"loanTermYears":{"value":null,"confidence":0}}}

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

  if (doc.docType !== 'OFFERING_MEMORANDUM') {
    return NextResponse.json({ error: 'MF extraction only supports Offering Memorandums' }, { status: 422 })
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

  let result: unknown
  try {
    const anthropic = getAnthropic(apiKey)
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: [fileBlock, { type: 'text', text: MF_PROMPT }] }],
    })

    const text = message.content.find(b => b.type === 'text')?.text ?? ''
    const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    result = JSON.parse(cleaned)
  } catch (err) {
    console.error('[ai/extract-mf]', err)
    return NextResponse.json({ error: `Extraction failed: ${err instanceof Error ? err.message : 'unknown error'}` }, { status: 500 })
  }

  await db.document.update({
    where: { id: doc.id },
    data: { extractedData: result as object },
  })

  return NextResponse.json(result)
}
