import {
  getJurisdictionQuestion,
  type JurisdictionQuestionDefinition,
} from './jurisdiction-question-library'

export type JurisdictionPublicationMode = 'AI_AUTO' | 'HUMAN_SINGLE' | 'HUMAN_BATCH'

export interface JurisdictionPublicationEvidence {
  sourceUrl?: string | null
  sourceSnippet?: string | null
  reviewerId?: string | null
}

export type JurisdictionPublicationDecision =
  | { allowed: true; question: JurisdictionQuestionDefinition }
  | {
      allowed: false
      code:
        | 'UNKNOWN_QUESTION'
        | 'AI_REVIEW_REQUIRED'
        | 'INDIVIDUAL_REVIEW_REQUIRED'
        | 'SOURCE_URL_REQUIRED'
        | 'SOURCE_SNIPPET_REQUIRED'
        | 'REVIEWER_REQUIRED'
      question: JurisdictionQuestionDefinition | null
    }

export function evaluateJurisdictionPublication(input: {
  section: string
  fieldKey: string
  mode: JurisdictionPublicationMode
  evidence: JurisdictionPublicationEvidence
}): JurisdictionPublicationDecision {
  const question = getJurisdictionQuestion(input.section, input.fieldKey)
  if (!question) return { allowed: false, code: 'UNKNOWN_QUESTION', question: null }

  // Until source authority verification is persisted, AI always proposes candidates; it never publishes truth.
  if (input.mode === 'AI_AUTO') {
    return { allowed: false, code: 'AI_REVIEW_REQUIRED', question }
  }
  if (input.mode === 'HUMAN_BATCH' && !question.batchReviewAllowed) {
    return { allowed: false, code: 'INDIVIDUAL_REVIEW_REQUIRED', question }
  }
  if (!input.evidence.sourceUrl?.trim()) {
    return { allowed: false, code: 'SOURCE_URL_REQUIRED', question }
  }
  if (!input.evidence.sourceSnippet?.trim()) {
    return { allowed: false, code: 'SOURCE_SNIPPET_REQUIRED', question }
  }
  if (!input.evidence.reviewerId?.trim()) {
    return { allowed: false, code: 'REVIEWER_REQUIRED', question }
  }
  return { allowed: true, question }
}

export function reviewedProfileField(input: {
  extractedValue: Record<string, unknown>
  question: JurisdictionQuestionDefinition
  reviewerId: string
  reviewedAt?: Date
}): Record<string, unknown> {
  return {
    ...input.extractedValue,
    questionId: input.question.id,
    questionSchemaVersion: input.question.schemaVersion,
    authorityClass: input.question.expectedAuthority,
    verificationState: 'REVIEWED',
    verifiedAt: (input.reviewedAt ?? new Date()).toISOString(),
    verifiedById: input.reviewerId,
  }
}
