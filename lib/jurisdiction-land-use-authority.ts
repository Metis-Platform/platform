import { claimFreshnessStatus } from './jurisdiction-claim-freshness'
import { COUNTY_LAND_USE_AUTHORITY_SCOPE_FIELD } from './jurisdiction-question-library'

export const COUNTY_WIDE_LAND_USE_AUTHORITY_SCOPE = 'COUNTY_WIDE' as const
export const UNINCORPORATED_COUNTY_LAND_USE_AUTHORITY_SCOPE = 'UNINCORPORATED_COUNTY' as const
export type CountyLandUseAuthorityScope =
  | typeof COUNTY_WIDE_LAND_USE_AUTHORITY_SCOPE
  | typeof UNINCORPORATED_COUNTY_LAND_USE_AUTHORITY_SCOPE

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
      scope: CountyLandUseAuthorityScope
    }

function verifiedLocalAuthority(value: SourceAuthorityRecord | null): value is SourceAuthorityRecord {
  return value?.authorityStatus === 'VERIFIED'
    && value.authorityClass === 'LOCAL_OFFICIAL'
    && Boolean(value.authorityOwner?.trim())
    && value.authorityVerifiedAt instanceof Date
    && !Number.isNaN(value.authorityVerifiedAt.getTime())
    && Boolean(value.authorityVerifiedBy?.trim())
}

export function isCurrentVerifiedLocalAuthorityClaim(
  claim: CountyLandUseAuthorityClaim,
  scope: CountyLandUseAuthorityScope,
  now = new Date(),
): boolean {
  const evidence = claim.evidence[0]
  return claim.section === 'zoning'
    && claim.fieldKey === COUNTY_LAND_USE_AUTHORITY_SCOPE_FIELD
    && claim.value === scope
    && claim.geographicScope === scope
    && claim.expectedAuthorityClass === 'LOCAL_OFFICIAL'
    && claim.sourceAuthorityClass === 'LOCAL_OFFICIAL'
    && claim.sourceAuthorityStatus === 'VERIFIED'
    && Boolean(claim.sourceAuthorityOwner?.trim())
    && claim.sourceAuthorityVerifiedAt instanceof Date
    && !Number.isNaN(claim.sourceAuthorityVerifiedAt.getTime())
    && Boolean(claim.sourceAuthorityVerifiedBy?.trim())
    && claim.verificationState === 'VERIFIED'
    && Boolean(claim.freshness)
    && claimFreshnessStatus(claim.freshness!, now) === 'CURRENT'
    && Boolean(evidence?.sourceUrl)
    && verifiedLocalAuthority(evidence?.sourceUrlRecord ?? null)
}

/**
 * A county-wide declaration is intentionally the only authority scope that can
 * enable county land-use rules without a parcel-boundary resolver. It is
 * checked against the current source projection so a later source rejection
 * immediately fails closed rather than trusting historical claim metadata.
 */
export function resolveCountyLandUseAuthority(
  claims: ReadonlyArray<CountyLandUseAuthorityClaim>,
  options: {
    unincorporatedBoundaryClaimIds?: ReadonlySet<string>
    incorporatedPlace?: boolean
  } = {},
  now = new Date(),
): CountyLandUseAuthority {
  for (const claim of claims) {
    if (!isCurrentVerifiedLocalAuthorityClaim(claim, COUNTY_WIDE_LAND_USE_AUTHORITY_SCOPE, now)) continue

    return {
      status: 'VERIFIED',
      claimId: claim.id,
      sourceUrl: claim.evidence[0].sourceUrl,
      verifiedAt: claim.reviewedAt.toISOString(),
      scope: COUNTY_WIDE_LAND_USE_AUTHORITY_SCOPE,
    }
  }
  if (options.incorporatedPlace || !options.unincorporatedBoundaryClaimIds?.size) {
    return { status: 'UNRESOLVED' }
  }
  for (const claim of claims) {
    if (
      !options.unincorporatedBoundaryClaimIds.has(claim.id) ||
      !isCurrentVerifiedLocalAuthorityClaim(claim, UNINCORPORATED_COUNTY_LAND_USE_AUTHORITY_SCOPE, now)
    ) continue
    return {
      status: 'VERIFIED',
      claimId: claim.id,
      sourceUrl: claim.evidence[0].sourceUrl,
      verifiedAt: claim.reviewedAt.toISOString(),
      scope: UNINCORPORATED_COUNTY_LAND_USE_AUTHORITY_SCOPE,
    }
  }
  return { status: 'UNRESOLVED' }
}
