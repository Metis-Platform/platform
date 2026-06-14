import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { getAnthropic, resolveAnthropicKey } from '@/lib/ai'

const SETTINGS_URL = '/dashboard/settings/ai'
const MAX_DEALS = 200

type Message = { role: 'user' | 'assistant'; content: string }

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

  const body = await req.json().catch(() => ({})) as { messages?: Message[] }
  const messages: Message[] = Array.isArray(body.messages) ? body.messages.slice(-40) : []
  if (messages.length === 0 || messages[messages.length - 1]?.role !== 'user') {
    return NextResponse.json({ error: 'No user message provided' }, { status: 400 })
  }

  // Build portfolio context
  const [rawDeals, openTasks] = await Promise.all([
    db.deal.findMany({
      where: { tenantId: tenant.id },
      include: {
        property: { include: { jurisdiction: { select: { county: true, state: true } } } },
        events: {
          where: { status: { in: ['PENDING', 'OVERDUE'] } },
          orderBy: { dueDate: 'asc' },
          take: 1,
          select: { eventType: true, label: true, dueDate: true, status: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: MAX_DEALS,
    }),
    db.task.findMany({
      where: { tenantId: tenant.id, status: { in: ['OPEN', 'IN_PROGRESS'] } },
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
      take: 50,
      select: {
        id: true, title: true, priority: true, dueDate: true,
        deal: { select: { id: true } },
      },
    }),
  ])

  // Portfolio totals
  const totalInvested = rawDeals
    .filter(d => d.status === 'ACTIVE')
    .reduce((sum, d) => sum + (d.purchasePrice ? Number(d.purchasePrice) : 0), 0)

  const dealsByStatus: Record<string, number> = {}
  const dealsByStrategy: Record<string, number> = {}
  for (const d of rawDeals) {
    dealsByStatus[d.status] = (dealsByStatus[d.status] ?? 0) + 1
    dealsByStrategy[d.strategyType] = (dealsByStrategy[d.strategyType] ?? 0) + 1
  }

  const deals = rawDeals.map(d => ({
    id: d.id,
    strategy: d.strategyType,
    status: d.status,
    apn: d.property.apn,
    address: d.property.address ?? null,
    county: d.property.jurisdiction.county,
    state: d.property.jurisdiction.state,
    purchasePrice: d.purchasePrice ? Number(d.purchasePrice) : null,
    nextEvent: d.events[0]
      ? { label: d.events[0].label, dueDate: d.events[0].dueDate.toISOString().slice(0, 10), status: d.events[0].status }
      : null,
  }))

  const tasks = openTasks.map(t => ({
    id: t.id,
    title: t.title,
    priority: t.priority,
    dueDate: t.dueDate?.toISOString().slice(0, 10) ?? null,
    dealId: t.deal?.id ?? null,
  }))

  const contextData = {
    asOf: new Date().toISOString().slice(0, 10),
    portfolio: { totalDeals: rawDeals.length, totalInvested, dealsByStatus, dealsByStrategy },
    deals,
    openTasks: tasks,
  }

  const systemPrompt = `You are Deal Copilot, an AI assistant built into Metis — a real estate investment management platform.
You have access to the user's live portfolio data below. Answer questions about their deals, deadlines, financials, and tasks.
Be concise and specific. Use the actual deal IDs, APNs, and dates from the data. Today's date is ${contextData.asOf}.

PORTFOLIO DATA:
${JSON.stringify(contextData, null, 2)}`

  const anthropic = getAnthropic(apiKey)

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      try {
        const stream = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 2048,
          system: systemPrompt,
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          stream: true,
        })

        for await (const event of stream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`))
          }
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      } catch (err) {
        console.error('[ai/copilot] stream error', err)
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Stream interrupted' })}\n\n`))
      }
      controller.close()
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
