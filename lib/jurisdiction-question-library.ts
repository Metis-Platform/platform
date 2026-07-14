import { OFFICE_TYPE_FIELDS } from './jurisdiction-extraction'
import {
  CONTACT_FIELDS,
  MARKET_SIGNAL_FIELDS,
  STRATEGY_RESEARCH_FIELDS,
  type ResearchStrategy,
} from './jurisdiction-research'
import type { JurisdictionProfileSection } from './jurisdiction-profile'
import type { JurisdictionAuthorityClass } from './jurisdiction-authority'

export const JURISDICTION_QUESTION_SCHEMA_VERSION = '2026-07-14.v2' as const

export type JurisdictionClaimRisk = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type JurisdictionClaimVolatility = 'STATIC' | 'ANNUAL' | 'QUARTERLY' | 'PER_SALE'

export type JurisdictionEvidenceRequirement =
  | 'SOURCE_URL'
  | 'SOURCE_SNIPPET'
  | 'HUMAN_REVIEW'

export interface JurisdictionQuestionDefinition {
  id: string
  schemaVersion: typeof JURISDICTION_QUESTION_SCHEMA_VERSION
  section: JurisdictionProfileSection
  fieldKey: string
  label: string
  strategies: ResearchStrategy[]
  risk: JurisdictionClaimRisk
  volatility: JurisdictionClaimVolatility
  expectedAuthority: JurisdictionAuthorityClass
  requiredEvidence: JurisdictionEvidenceRequirement[]
  batchReviewAllowed: boolean
}

function questionKey(section: JurisdictionProfileSection, fieldKey: string): string {
  return `${section}.${fieldKey}`
}

function riskFor(section: JurisdictionProfileSection, fieldKey: string): JurisdictionClaimRisk {
  if (/(?:Url|URL|Portal|Phone|Contact)$/i.test(fieldKey)) return 'LOW'
  if (section === 'contacts' || section === 'marketSignals') return 'MEDIUM'
  if (
    section === 'taxSale' ||
    section === 'foreclosure' ||
    section === 'zoning' ||
    section === 'landlordTenant' ||
    section === 'wholesale'
  ) return 'CRITICAL'
  return 'HIGH'
}

function authorityFor(section: JurisdictionProfileSection): JurisdictionAuthorityClass {
  if (section === 'marketSignals') return 'MARKET_DATA'
  if (
    section === 'taxSale' ||
    section === 'foreclosure' ||
    section === 'recording' ||
    section === 'landlordTenant' ||
    section === 'wholesale'
  ) return 'STATE_OFFICIAL_OR_STATUTE'
  return 'LOCAL_OFFICIAL'
}

function volatilityFor(
  section: JurisdictionProfileSection,
  fieldKey: string,
): JurisdictionClaimVolatility {
  for (const definitions of Object.values(OFFICE_TYPE_FIELDS)) {
    const definition = definitions.find(field =>
      field.section === section && field.fieldKey === fieldKey
    )
    if (definition) return definition.volatility.toUpperCase() as JurisdictionClaimVolatility
  }
  if (/(?:Url|URL|Portal)$/i.test(fieldKey)) return 'STATIC'
  if (section === 'contacts' || section === 'marketSignals') return 'QUARTERLY'
  if (section === 'taxSale') return 'ANNUAL'
  return 'STATIC'
}

type MutableQuestion = {
  section: JurisdictionProfileSection
  fieldKey: string
  label: string
  strategies: Set<ResearchStrategy>
}

function buildQuestionLibrary(): JurisdictionQuestionDefinition[] {
  const fields = new Map<string, MutableQuestion>()
  const add = (
    section: JurisdictionProfileSection,
    fieldKey: string,
    label: string,
    strategy?: ResearchStrategy
  ) => {
    const key = questionKey(section, fieldKey)
    const existing = fields.get(key)
    if (existing) {
      if (strategy) existing.strategies.add(strategy)
      return
    }
    fields.set(key, {
      section,
      fieldKey,
      label,
      strategies: new Set(strategy ? [strategy] : []),
    })
  }

  for (const [strategy, definitions] of Object.entries(STRATEGY_RESEARCH_FIELDS)) {
    for (const definition of definitions) {
      add(definition.section, definition.key, definition.label, strategy as ResearchStrategy)
    }
  }
  for (const definition of [...MARKET_SIGNAL_FIELDS, ...CONTACT_FIELDS]) {
    add(definition.section, definition.key, definition.label)
  }
  for (const definitions of Object.values(OFFICE_TYPE_FIELDS)) {
    for (const definition of definitions) {
      add(definition.section, definition.fieldKey, definition.description)
    }
  }

  return [...fields.values()]
    .map(field => {
      const risk = riskFor(field.section, field.fieldKey)
      return {
        id: `jurisdiction.${JURISDICTION_QUESTION_SCHEMA_VERSION}.${field.section}.${field.fieldKey}`,
        schemaVersion: JURISDICTION_QUESTION_SCHEMA_VERSION,
        section: field.section,
        fieldKey: field.fieldKey,
        label: field.label,
        strategies: [...field.strategies].sort(),
        risk,
        volatility: volatilityFor(field.section, field.fieldKey),
        expectedAuthority: authorityFor(field.section),
        requiredEvidence: [
          'SOURCE_URL' as const,
          'SOURCE_SNIPPET' as const,
          ...(risk === 'HIGH' || risk === 'CRITICAL' ? ['HUMAN_REVIEW' as const] : []),
        ],
        batchReviewAllowed: risk === 'LOW' || risk === 'MEDIUM',
      }
    })
    .sort((a, b) => a.id.localeCompare(b.id))
}

export const JURISDICTION_QUESTIONS = buildQuestionLibrary()
const QUESTIONS_BY_FIELD = new Map(
  JURISDICTION_QUESTIONS.map(question => [questionKey(question.section, question.fieldKey), question])
)

export function getJurisdictionQuestion(
  section: string,
  fieldKey: string
): JurisdictionQuestionDefinition | null {
  return QUESTIONS_BY_FIELD.get(`${section}.${fieldKey}`) ?? null
}
