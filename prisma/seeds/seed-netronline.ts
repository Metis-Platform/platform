/**
 * Seed county office URLs from NETROnline public records directory.
 * Run: npx tsx prisma/seeds/seed-netronline.ts
 * Requires: DATABASE_URL and ANTHROPIC_API_KEY in .env.local
 */
import { config } from 'dotenv'
import Anthropic from '@anthropic-ai/sdk'
import { createSeedPrismaClient } from './db'

config({ path: '.env.local' })

// FL first (Tier 1), then remaining states alphabetically
const STATE_ABBREVS = [
  'FL',
  'TX', 'GA', 'AZ', 'IL', 'OH', 'TN', 'MD', 'NC', 'CO',
  'AL', 'AK', 'AR', 'CA', 'CT', 'DE',
  'HI', 'ID', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'ND', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
]

async function fetchWithJina(url: string): Promise<string> {
  const jinaUrl = `https://r.jina.ai/${url}`
  const headers: Record<string, string> = { Accept: 'text/markdown' }
  if (process.env.JINA_API_KEY) headers['Authorization'] = `Bearer ${process.env.JINA_API_KEY}`
  const res = await fetch(jinaUrl, { headers, signal: AbortSignal.timeout(30000) })
  if (!res.ok) throw new Error(`Jina fetch failed: ${res.status} ${res.statusText}`)
  return res.text()
}

type CountyUrlEntry = { county: string; officeType: string; url: string }

async function extractCountyUrls(
  anthropic: Anthropic,
  state: string,
  content: string,
): Promise<CountyUrlEntry[]> {
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `Extract all county public records office URLs from this NETROnline directory page for ${state}.

Content:
<content>
${content.slice(0, 15000)}
</content>

For each county office link found, return:
{ "county": "County Name (no 'County' suffix)", "officeType": "assessor|tax_collector|recorder|gis|planning_zoning|building", "url": "full https:// URL" }

Office type mapping:
- Assessor, Appraiser, Property Valuation → assessor
- Tax Collector, Treasurer, Revenue Commissioner → tax_collector
- Recorder, Register of Deeds, Clerk of Courts, Circuit Clerk → recorder
- GIS, Mapping, Land Records → gis
- Planning, Zoning, Community Development → planning_zoning
- Building, Building Inspection, Building Department → building

Return only the JSON array. If no entries found, return [].`,
      },
    ],
  })

  const text = message.content.find(b => b.type === 'text')?.text ?? ''
  const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
  try {
    const parsed = JSON.parse(cleaned)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function normalizeCounty(name: string): string {
  return name.toLowerCase().replace(/\s+county$/, '').trim()
}

async function main() {
  const prisma = createSeedPrismaClient()
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is required in .env.local')

  const anthropic = new Anthropic({ apiKey })

  const allJurisdictions = await prisma.jurisdiction.findMany({
    select: { id: true, state: true, county: true },
  })
  const byStateCounty = new Map(
    allJurisdictions.map(j => [`${j.state}:${normalizeCounty(j.county)}`, j.id]),
  )

  let created = 0
  let skipped = 0
  let noMatch = 0

  for (const state of STATE_ABBREVS) {
    console.log(`\nProcessing ${state}...`)

    let content: string
    try {
      content = await fetchWithJina(`https://publicrecords.netronline.com/state/${state}`)
      await new Promise(r => setTimeout(r, 2000))
    } catch (err) {
      console.error(`  Fetch failed for ${state}: ${err}`)
      continue
    }

    let entries: CountyUrlEntry[]
    try {
      entries = await extractCountyUrls(anthropic, state, content)
      await new Promise(r => setTimeout(r, 500))
    } catch (err) {
      console.error(`  Extraction failed for ${state}: ${err}`)
      continue
    }

    console.log(`  Found ${entries.length} entries`)

    for (const entry of entries) {
      const key = `${state}:${normalizeCounty(entry.county)}`
      const jurisdictionId = byStateCounty.get(key)

      if (!jurisdictionId) {
        console.log(`  No match: ${state} / ${entry.county}`)
        noMatch++
        continue
      }

      if (!entry.url?.startsWith('http')) {
        skipped++
        continue
      }

      try {
        await prisma.jurisdictionSourceUrl.upsert({
          where: {
            jurisdictionId_officeType_url: {
              jurisdictionId,
              officeType: entry.officeType,
              url: entry.url,
            },
          },
          update: {},
          create: { jurisdictionId, officeType: entry.officeType, url: entry.url },
        })
        created++
      } catch (err) {
        console.error(`  Upsert failed ${state}/${entry.county}/${entry.officeType}: ${err}`)
        skipped++
      }
    }
  }

  console.log(`\nDone. Created: ${created} | No DB match: ${noMatch} | Skipped: ${skipped}`)
  await prisma.$disconnect()
}

main().catch(e => { console.error('Seed failed:', e); process.exit(1) })
