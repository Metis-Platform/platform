import { claimFreshnessStatus } from './jurisdiction-claim-freshness'
import { COUNTY_WIDE_LAND_USE_AUTHORITY_FIELD } from './jurisdiction-question-library'

export const COUNTY_WIDE_LAND_USE_AUTHORITY_SCOPE = 'COUNTY_WIDE' as const

type SourceAuthorityRecord = {
  authorityClass: string | null
  authorityOwner: string | null
  authorityStatus: 'UNVERIFIED' | 'VERIFIED' | 'REJECTED'
  authorityVerifiedAt: Date | null
  authorityVerifiedBy: string | null
}

export type CountyLandUseAuthorityClaim = {
  id: string
  section: string
  fieldKey: string
  value: unknown
  geographicScope: string | null
  expectedAuthorityClass: string
  sourceAuthorityClass: string | null
  sourceAuthorityOwner: string | null
  sourceAuthorityStatus: 'UNVERIFIED' | 'VERIFIED' | 'REJECTED'
  sourceAuthorityVerifiedAt: Date | null
  sourceAuthorityVerifiedBy: string | null
  verificationState: 'REVIEWED' | 'VERIFIED' | 'STALE' | 'BLOCKED' | 'SUPERSEDED'
  reviewedAt: Date
  freshness: { reviewDueAt: Date; staleAt: Date } | null
  evidence: ReadonlyArray<{
    sourceUrl: string
    sourceUrlRecord: SourceAuthorityRecord | null
  }>
}

export type CountyLandUseAuthority =
  | { status: 'UNRESOLVED' }
  | {
      status: 'VERIFIED'
      claimId: string
      sourceUrl: string
      verifiedAt: string
    }

function verifiedLocalAuthority(value: SourceAuthorityRecord | null): value is SourceAuthorityRecord {
  return value?.authorityStatus === 'VERIFIED'
    && value.authorityClass === 'LOCAL_OFFICIAL'
    && Boolean(value.authorityOwner?.trim())
    && value.authorityVerifiedAt instanceof Date
    && !Number.isNaN(value.authorityVerifiedAt.getTime())
    && Boolean(value.authorityVerifiedBy?.trim())
}

/**
 * A county-wide declaration is intentionally the only authority scope that can
 * enable county land-use rules without a parcel-boundary resolver. It is
 * checked against the current source projection so a later source rejection
 * immediately fails closed rather than trusting historical claim metadata.
 */
export function resolveCountyLandUseAuthority(
  claims: ReadonlyArray<CountyLandUseAuthorityClaim>,
  now = new Date(),
): CountyLandUseAuthority {
  for (const claim of claims) {
    const evidence = claim.evidence[0]
    if (
      claim.section !== 'zoning' ||
      claim.fieldKey !== COUNTY_WIDE_LAND_USE_AUTHORITY_FIELD ||
      claim.value !== COUNTY_WIDE_LAND_USE_AUTHORITY_SCOPE ||
      claim.geographicScope !== COUNTY_WIDE_LAND_USE_AUTHORITY_SCOPE ||
      claim.expectedAuthorityClass !== 'LOCAL_OFFICIAL' ||
      claim.sourceAuthorityClass !== 'LOCAL_OFFICIAL' ||
      claim.sourceAuthorityStatus !== 'VERIFIED' ||
      !claim.sourceAuthorityOwner?.trim() ||
      !(claim.sourceAuthorityVerifiedAt instanceof Date) ||
      Number.isNaN(claim.sourceAuthorityVerifiedAt.getTime()) ||
      !claim.sourceAuthorityVerifiedBy?.trim() ||
      claim.verificationState !== 'VERIFIED' ||
      !claim.freshness ||
      claimFreshnessStatus(claim.freshness, now) !== 'CURRENT' ||
      !evidence?.sourceUrl ||
      !verifiedLocalAuthority(evidence.sourceUrlRecord)
    ) continue

    return {
      status: 'VERIFIED',
      claimId: claim.id,
      sourceUrl: evidence.sourceUrl,
      verifiedAt: claim.reviewedAt.toISOString(),
    }
  }
  return { status: 'UNRESOLVED' }
}
