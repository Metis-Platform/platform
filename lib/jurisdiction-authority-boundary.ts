import { db } from './db'
import { randomUUID } from 'node:crypto'
import { isPolygonGeometry } from './geo/types'
import {
  isCurrentVerifiedLocalAuthorityClaim,
  UNINCORPORATED_COUNTY_LAND_USE_AUTHORITY_SCOPE,
  type CountyLandUseAuthorityClaim,
} from './jurisdiction-land-use-authority'

export async function lookupUnincorporatedAuthorityBoundaryClaimIds(
  jurisdictionId: string,
  lat: number,
  lon: number,
): Promise<Set<string>> {
  if (!jurisdictionId || !Number.isFinite(lat) || !Number.isFinite(lon)) return new Set()

  try {
    const rows = await db.$queryRaw<Array<{ claim_id: string }>>`
      SELECT claim_id
      FROM jurisdiction_authority_boundaries
      WHERE jurisdiction_id = ${jurisdictionId}
        AND scope = 'UNINCORPORATED_COUNTY'
        AND superseded_by_id IS NULL
        AND ST_Covers(geom, ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326))
    `
    return new Set(rows.map(row => row.claim_id))
  } catch (error) {
    // Preview deployments can run before the main-branch migration workflow.
    // Until the table exists, preserve the established fail-closed authority result.
    if (isAuthorityBoundarySchemaPending(error)) return new Set()
    throw error
  }
}

export function isAuthorityBoundarySchemaPending(error: unknown): boolean {
  return error instanceof Error
    && error.message.includes('jurisdiction_authority_boundaries')
    && error.message.includes('does not exist')
}

export async function publishUnincorporatedAuthorityBoundary(input: {
  jurisdictionId: string
  claimId: string
  geometry: unknown
  reviewerId: string
  replacesBoundaryId?: string
}) {
  if (!input.reviewerId.trim()) throw new Error('REVIEWER_REQUIRED')
  if (!isPolygonGeometry(input.geometry)) throw new Error('BOUNDARY_GEOMETRY_INVALID')
  const geometryJson = JSON.stringify(input.geometry)
  const boundaryId = randomUUID()

  return db.$transaction(async tx => {
    // The claim lock serializes first publication and any replacement chain.
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "JurisdictionClaim"
      WHERE id = ${input.claimId} AND "jurisdictionId" = ${input.jurisdictionId}
      FOR UPDATE
    `
    if (locked.length !== 1) throw new Error('AUTHORITY_CLAIM_NOT_FOUND')

    const claim = await tx.jurisdictionClaim.findFirst({
      where: {
        id: input.claimId,
        jurisdictionId: input.jurisdictionId,
        supersededByClaim: null,
      },
      select: {
        id: true,
        section: true,
        fieldKey: true,
        value: true,
        geographicScope: true,
        expectedAuthorityClass: true,
        sourceAuthorityClass: true,
        sourceAuthorityOwner: true,
        sourceAuthorityStatus: true,
        sourceAuthorityVerifiedAt: true,
        sourceAuthorityVerifiedBy: true,
        verificationState: true,
        reviewedAt: true,
        freshness: { select: { reviewDueAt: true, staleAt: true } },
        evidence: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            sourceUrl: true,
            sourceUrlRecord: {
              select: {
                authorityClass: true,
                authorityOwner: true,
                authorityStatus: true,
                authorityVerifiedAt: true,
                authorityVerifiedBy: true,
              },
            },
          },
        },
      },
    })
    if (!claim || !isCurrentVerifiedLocalAuthorityClaim(
      claim as CountyLandUseAuthorityClaim,
      UNINCORPORATED_COUNTY_LAND_USE_AUTHORITY_SCOPE,
    )) {
      throw new Error('AUTHORITY_CLAIM_NOT_CURRENT_VERIFIED')
    }

    const current = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM jurisdiction_authority_boundaries
      WHERE jurisdiction_id = ${input.jurisdictionId}
        AND claim_id = ${input.claimId}
        AND superseded_by_id IS NULL
      FOR UPDATE
    `
    const currentId = current[0]?.id
    if (currentId && input.replacesBoundaryId !== currentId) throw new Error('STALE_AUTHORITY_BOUNDARY')
    if (!currentId && input.replacesBoundaryId) throw new Error('STALE_AUTHORITY_BOUNDARY')

    const inserted = await tx.$queryRaw<Array<{ id: string }>>`
      WITH candidate AS (
        SELECT ST_SetSRID(ST_Multi(ST_GeomFromGeoJSON(${geometryJson})), 4326) AS geom
      )
      INSERT INTO jurisdiction_authority_boundaries (
        id, jurisdiction_id, claim_id, scope, geom, created_by, supersedes_boundary_id
      )
      SELECT
        ${boundaryId}, ${input.jurisdictionId}, ${input.claimId},
        'UNINCORPORATED_COUNTY', geom, ${input.reviewerId}, ${currentId ?? null}
      FROM candidate
      WHERE ST_IsValid(geom) AND NOT ST_IsEmpty(geom)
      RETURNING id
    `
    if (inserted.length !== 1) throw new Error('BOUNDARY_GEOMETRY_INVALID')
    if (currentId) {
      const superseded = await tx.$executeRaw`
        UPDATE jurisdiction_authority_boundaries
        SET superseded_by_id = ${boundaryId}
        WHERE id = ${currentId} AND superseded_by_id IS NULL
      `
      if (superseded !== 1) throw new Error('STALE_AUTHORITY_BOUNDARY')
    }

    return { boundaryId, claimId: input.claimId }
  })
}
