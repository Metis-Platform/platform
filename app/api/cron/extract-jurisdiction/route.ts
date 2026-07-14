import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  buildExtractionPrompt,
  getPlatformAnthropic,
  hashContent,
  parseExtractionResponse,
  HAIKU_MODEL,
  SONNET_MODEL,
  SONNET_FALLBACK_CONFIDENCE,
  type ExtractionResult,
} from '@/lib/jurisdiction-extraction'
import { evaluateJurisdictionPublication } from '@/lib/jurisdiction-publication-policy'
import { guardCronRequest } from '@/lib/cron-guard'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Tier-1 states — processed first
const TIER1_STATES = ['FL', 'TX', 'GA', 'AZ', 'IL', 'OH', 'TN', 'MD', 'NC', 'CO']
const BATCH_SIZE = 5
const STALE_DAYS = 7

async function fetchWithJina(url: string): Promise<string> {
  const jinaUrl = `https://r.jina.ai/${url}`
  const headers: Record<string, string> = { Accept: 'text/markdown' }
  if (process.env.JINA_API_KEY) headers['Authorization'] = `Bearer ${process.env.JINA_API_KEY}`
  const res = await fetch(jinaUrl, { headers, signal: AbortSignal.timeout(20000) })
  if (!res.ok) throw new Error(`Jina fetch failed: ${res.status}`)
  return res.text()
}

async function runExtraction(
  county: string,
  state: string,
  officeType: string,
  content: string,
): Promise<ExtractionResult[]> {
  const anthropic = getPlatformAnthropic()
  const prompt = buildExtractionPrompt(officeType, county, state, content)

  const haikuMsg = await anthropic.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  })

  const haikuText = haikuMsg.content.find(b => b.type === 'text')?.text ?? ''
  const results = parseExtractionResponse(haikuText)

  // Run Sonnet second-pass on low-confidence fields
  const lowConf = results.filter(r => r.confidence < SONNET_FALLBACK_CONFIDENCE + 0.1)
  if (lowConf.length > 0) {
    const sonnetPrompt = buildExtractionPrompt(officeType, county, state, content) +
      `\n\nFocus specifically on these uncertain fields: ${lowConf.map(r => `${r.section}.${r.fieldKey}`).join(', ')}`

    const sonnetMsg = await anthropic.messages.create({
      model: SONNET_MODEL,
      max_tokens: 1024,
      messages: [{ role: 'user', content: sonnetPrompt }],
    })
    const sonnetText = sonnetMsg.content.find(b => b.type === 'text')?.text ?? ''
    const sonnetResults = parseExtractionResponse(sonnetText)

    // Merge: replace low-conf results with Sonnet's version if Sonnet is more confident
    for (const sr of sonnetResults) {
      const idx = results.findIndex(r => r.section === sr.section && r.fieldKey === sr.fieldKey)
      if (idx >= 0) {
        if (sr.confidence > results[idx].confidence) results[idx] = { ...sr }
      } else {
        results.push(sr)
      }
    }
  }

  return results
}

export async function GET(req: Request): Promise<NextResponse> {
  const blocked = guardCronRequest(req, { requiredSideEffects: ['ai'] })
  if (blocked) return blocked

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  const staleThreshold = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000)

  // Fetch a larger pool, then sort by tier priority in memory
  const pool = await db.jurisdictionSourceUrl.findMany({
    where: {
      OR: [{ lastFetchedAt: null }, { lastFetchedAt: { lt: staleThreshold } }],
    },
    include: { jurisdiction: { select: { county: true, state: true } } },
    take: BATCH_SIZE * 5,
  })

  const batch = pool
    .sort((a, b) => {
      const ai = TIER1_STATES.indexOf(a.jurisdiction.state)
      const bi = TIER1_STATES.indexOf(b.jurisdiction.state)
      if (ai === -1 && bi === -1) return 0
      if (ai === -1) return 1
      if (bi === -1) return -1
      return ai - bi
    })
    .slice(0, BATCH_SIZE)

  const stats = { processed: 0, skipped: 0, extracted: 0, published: 0, errors: 0 }

  for (const sourceUrl of batch) {
    const { county, state } = sourceUrl.jurisdiction

    let content: string
    try {
      content = await fetchWithJina(sourceUrl.url)
    } catch (err) {
      console.error(`[extract-jurisdiction] fetch failed ${county} ${state}: ${err}`)
      stats.errors++
      // Update lastFetchedAt even on failure so we don't retry immediately
      await db.jurisdictionSourceUrl.update({
        where: { id: sourceUrl.id },
        data: { lastFetchedAt: new Date() },
      })
      continue
    }

    const contentHash = hashContent(content)
    if (contentHash === sourceUrl.lastContentHash) {
      // No change — update timestamp and skip Claude
      await db.jurisdictionSourceUrl.update({
        where: { id: sourceUrl.id },
        data: { lastFetchedAt: new Date() },
      })
      stats.skipped++
      continue
    }

    let results: ExtractionResult[]
    try {
      results = await runExtraction(county, state, sourceUrl.officeType, content)
    } catch (err) {
      console.error(`[extract-jurisdiction] extraction failed ${county} ${state}: ${err}`)
      stats.errors++
      continue
    }

    const now = new Date().toISOString()

    for (const result of results) {
      const publication = evaluateJurisdictionPublication({
        section: result.section,
        fieldKey: result.fieldKey,
        mode: 'AI_AUTO',
        evidence: {
          sourceUrl: sourceUrl.url,
          sourceSnippet: result.sourceSnippet,
        },
      })
      if (!publication.question) {
        console.error(
          `[extract-jurisdiction] unregistered field ${result.section}.${result.fieldKey}`
        )
        stats.errors++
        continue
      }

      const profileField = {
        value: result.value,
        sourceUrl: sourceUrl.url,
        citation: result.sourceSnippet,
        retrievedAt: now,
        contentHash,
        confidence: result.confidence,
        volatility: result.volatility,
        questionId: publication.question.id,
        questionSchemaVersion: publication.question.schemaVersion,
        expectedAuthorityClass: publication.question.expectedAuthority,
        verificationState: 'CANDIDATE',
      }

      const modelUsed = result.confidence >= SONNET_FALLBACK_CONFIDENCE + 0.1 ? HAIKU_MODEL : SONNET_MODEL

      if (!publication.allowed) {
        // Model confidence controls queue priority only; it never establishes authority.
        const existing = await db.extractionCandidate.findFirst({
          where: {
            jurisdictionId: sourceUrl.jurisdictionId,
            section: result.section,
            fieldKey: result.fieldKey,
            status: 'PENDING',
          },
          select: { id: true },
        })

        if (existing) {
          await db.extractionCandidate.update({
            where: { id: existing.id },
            data: {
              sourceUrlId: sourceUrl.id,
              extractedValue: profileField,
              confidence: result.confidence,
              sourceSnippet: result.sourceSnippet,
              modelUsed,
            },
          })
        } else {
          await db.extractionCandidate.create({
            data: {
              jurisdictionId: sourceUrl.jurisdictionId,
              sourceUrlId: sourceUrl.id,
              section: result.section,
              fieldKey: result.fieldKey,
              extractedValue: profileField,
              confidence: result.confidence,
              sourceSnippet: result.sourceSnippet,
              modelUsed,
            },
          })
        }
        stats.extracted++
      } else {
        // No v1 questions permit AI auto-publication. This branch is explicit so a future
        // policy change cannot bypass a deliberate publication implementation/review.
        stats.errors++
      }
    }

    await db.jurisdictionSourceUrl.update({
      where: { id: sourceUrl.id },
      data: { lastFetchedAt: new Date(), lastContentHash: contentHash },
    })
    stats.processed++
  }

  return NextResponse.json({ ok: true, ...stats })
}
