import { describe, expect, it } from 'vitest'
import { OFFICE_TYPE_FIELDS } from './jurisdiction-extraction'
import {
  CONTACT_FIELDS,
  MARKET_SIGNAL_FIELDS,
  STRATEGY_RESEARCH_FIELDS,
} from './jurisdiction-research'
import {
  JURISDICTION_QUESTIONS,
  JURISDICTION_QUESTION_SCHEMA_VERSION,
  getJurisdictionQuestion,
} from './jurisdiction-question-library'
import { evaluateJurisdictionPublication, reviewedProfileField } from './jurisdiction-publication-policy'

describe('jurisdiction question library', () => {
  it('registers every current UI and extraction field with stable unique IDs', () => {
    const currentFields = [
      ...Object.values(STRATEGY_RESEARCH_FIELDS).flat(),
      ...MARKET_SIGNAL_FIELDS,
      ...CONTACT_FIELDS,
      ...Object.values(OFFICE_TYPE_FIELDS).flat().map(field => ({
        section: field.section,
        key: field.fieldKey,
      })),
    ]
    for (const field of currentFields) {
      expect(getJurisdictionQuestion(field.section, field.key), `${field.section}.${field.key}`).not.toBeNull()
    }
    expect(new Set(JURISDICTION_QUESTIONS.map(question => question.id)).size)
      .toBe(JURISDICTION_QUESTIONS.length)
    expect(JURISDICTION_QUESTION_SCHEMA_VERSION).toBe('2026-07-14.v1')
  })

  it('requires individual human review for every high-risk and critical question', () => {
    for (const question of JURISDICTION_QUESTIONS) {
      if (question.risk === 'HIGH' || question.risk === 'CRITICAL') {
        expect(question.requiredEvidence, question.id).toContain('HUMAN_REVIEW')
        expect(question.batchReviewAllowed, question.id).toBe(false)
      }
    }
  })
})

describe('jurisdiction publication policy', () => {
  const evidence = {
    sourceUrl: 'https://county.example.gov/rules',
    sourceSnippet: 'The rule applies beginning January 1.',
    reviewerId: 'reviewer@example.test',
  }

  it('never lets confidence or AI mode publish a protected claim', () => {
    const decision = evaluateJurisdictionPublication({
      section: 'taxSale',
      fieldKey: 'redemptionPeriodDays',
      mode: 'AI_AUTO',
      evidence,
    })
    expect(decision).toMatchObject({ allowed: false, code: 'AI_REVIEW_REQUIRED' })
    expect(decision.question?.risk).toBe('CRITICAL')
  })

  it('keeps every registered AI result in candidate state regardless of risk', () => {
    for (const question of JURISDICTION_QUESTIONS) {
      expect(evaluateJurisdictionPublication({
        section: question.section,
        fieldKey: question.fieldKey,
        mode: 'AI_AUTO',
        evidence,
      }), question.id).toMatchObject({ allowed: false, code: 'AI_REVIEW_REQUIRED' })
    }
  })

  it('fails closed for unknown fields and missing evidence', () => {
    expect(evaluateJurisdictionPublication({
      section: 'zoning',
      fieldKey: 'hallucinatedVerdict',
      mode: 'HUMAN_SINGLE',
      evidence,
    })).toMatchObject({ allowed: false, code: 'UNKNOWN_QUESTION' })
    expect(evaluateJurisdictionPublication({
      section: 'zoning',
      fieldKey: 'minimumLotSizeSqft',
      mode: 'HUMAN_SINGLE',
      evidence: { reviewerId: 'reviewer@example.test' },
    })).toMatchObject({ allowed: false, code: 'SOURCE_URL_REQUIRED' })
    expect(evaluateJurisdictionPublication({
      section: 'zoning',
      fieldKey: 'minimumLotSizeSqft',
      mode: 'HUMAN_SINGLE',
      evidence: { ...evidence, reviewerId: '' },
    })).toMatchObject({ allowed: false, code: 'REVIEWER_REQUIRED' })
  })

  it('requires individual review for high-risk claims but permits evidenced low-risk batching', () => {
    expect(evaluateJurisdictionPublication({
      section: 'zoning',
      fieldKey: 'minimumLotSizeSqft',
      mode: 'HUMAN_BATCH',
      evidence,
    })).toMatchObject({ allowed: false, code: 'INDIVIDUAL_REVIEW_REQUIRED' })
    expect(evaluateJurisdictionPublication({
      section: 'zoning',
      fieldKey: 'zoningMapUrl',
      mode: 'HUMAN_BATCH',
      evidence,
    })).toMatchObject({ allowed: true })
  })

  it('stamps reviewed fields with question, authority, and reviewer provenance', () => {
    const question = getJurisdictionQuestion('taxSale', 'saleType')!
    expect(reviewedProfileField({
      extractedValue: {
        value: 'tax_lien',
        confidence: 0.99,
        verifiedAt: '1999-01-01T00:00:00.000Z',
        verifiedById: 'untrusted-client',
        verificationState: 'VERIFIED',
      },
      question,
      reviewerId: 'reviewer@example.test',
      reviewedAt: new Date('2026-07-14T00:00:00.000Z'),
    })).toMatchObject({
      questionId: question.id,
      questionSchemaVersion: '2026-07-14.v1',
      authorityClass: question.expectedAuthority,
      verificationState: 'REVIEWED',
      verifiedAt: '2026-07-14T00:00:00.000Z',
      verifiedById: 'reviewer@example.test',
    })
  })
})
