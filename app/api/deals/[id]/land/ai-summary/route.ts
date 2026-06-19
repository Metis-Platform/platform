import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { syncUserToDatabase } from '@/lib/sync-user'
import { getAnthropic, resolveAnthropicKey } from '@/lib/ai'

const SETTINGS_URL = '/dashboard/settings/ai'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const synced = await syncUserToDatabase()
  if (!synced) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { tenant } = synced
  const { id: dealId } = await params

  let apiKey: string
  try {
    apiKey = await resolveAnthropicKey(tenant.id)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Add your Anthropic API key in Settings', settingsUrl: SETTINGS_URL },
      { status: 402 },
    )
  }

  const deal = await db.deal.findUnique({
    where: { id: dealId, tenantId: tenant.id },
    include: {
      property: { include: { jurisdiction: true } },
      land: true,
      landComps: { orderBy: { saleDate: 'desc' } },
    },
  })
  if (!deal || deal.strategyType !== 'LAND' || !deal.land) {
    return NextResponse.json({ error: 'Land deal not found' }, { status: 404 })
  }

  const acres = deal.property.acres != null ? Number(deal.property.acres.toString()) : null
  const comps = deal.landComps.map(c => ({
    address: c.address,
    acres: Number(c.acres.toString()),
    salePrice: Number(c.salePrice.toString()),
    saleDate: c.saleDate.toISOString().slice(0, 10),
  }))
  const avgPricePerAcre = comps.length > 0
    ? comps.reduce((sum, c) => sum + c.salePrice / c.acres, 0) / comps.length
    : null
  const impliedValue = avgPricePerAcre != null && acres != null ? avgPricePerAcre * acres : null

  const facts = {
    apn: deal.property.apn,
    county: deal.property.jurisdiction?.county,
    state: deal.property.jurisdiction?.state,
    acres,
    zoning: deal.land.zoning,
    access: deal.land.access,
    floodZone: deal.land.floodZone,
    wetlandsPercent: deal.land.wetlandsPercent != null ? Number(deal.land.wetlandsPercent.toString()) : null,
    purchasePrice: deal.purchasePrice != null ? Number(deal.purchasePrice.toString()) : null,
    comps,
    avgCompPricePerAcre: avgPricePerAcre,
    impliedValueFromComps: impliedValue,
  }

  const prompt = `You are summarizing what's known about a raw land parcel for an investor who is evaluating it (already purchased or considering a bid). Write a concise 3-5 sentence narrative covering: what the parcel is and where, any risk flags (flood zone, wetlands, lack of road access), what the comps imply about value (if any comps given), and one specific thing the investor should still verify before relying on this. Do not recommend whether to buy or give a price target beyond what the comps imply. Be direct and factual, no filler.

Parcel data (JSON):
${JSON.stringify(facts, null, 2)}`

  try {
    const anthropic = getAnthropic(apiKey)
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    })

    const summary = message.content.find(b => b.type === 'text')?.text?.trim() ?? ''
    const generatedAt = new Date()

    await db.dealLand.update({
      where: { dealId },
      data: { aiSummary: summary, aiSummaryGeneratedAt: generatedAt },
    })

    return NextResponse.json({ summary, generatedAt: generatedAt.toISOString() })
  } catch (err) {
    console.error('[land/ai-summary]', err)
    return NextResponse.json({ error: `Summary generation failed: ${err instanceof Error ? err.message : 'unknown error'}` }, { status: 500 })
  }
}
