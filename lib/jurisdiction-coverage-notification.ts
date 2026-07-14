import { createHash } from 'node:crypto'
import type { Prisma } from '@/app/generated/prisma'
import {
  summarizeJurisdictionCoverage,
  type CoverageCandidate,
  type CoverageClaim,
} from './jurisdiction-coverage'
import { buildResearchProfile } from './jurisdiction-research'
import { deriveJurisdictionCoverageState } from './jurisdiction-research-state'
import { JURISDICTION_QUESTIONS } from './jurisdiction-question-library'

type CoverageNotificationClaim = CoverageClaim & {
  sourceAuthorityStatus: string
}

export function verifiedCoverageVersion(input: {
  workStatus: 'DISCOVERING' | 'PAUSED' | null
  sourceCount: number
  profile: Parameters<typeof buildResearchProfile>[0]
  activeClaims: CoverageNotificationClaim[]
  pendingCandidates: CoverageCandidate[]
  now?: Date
}): string | null {
  const now = input.now ?? new Date()
  const profile = buildResearchProfile(input.profile)
  const projectedClaimIds = new Set(
    Object.values(profile).flatMap(section =>
      Object.values(section).flatMap(field => field.claimId ? [field.claimId] : []),
    ),
  )
  const projectedClaims = input.activeClaims.filter(claim => projectedClaimIds.has(claim.id))
  const coverage = summarizeJurisdictionCoverage({
    id: 'notification',
    state: 'notification',
    county: 'notification',
    isAvailable: false,
    profile,
    activeClaims: projectedClaims,
    pendingCandidates: input.pendingCandidates,
    verifiedSourceCount: 0,
    trackedPropertyCount: 0,
    researchRequestCount: 0,
    now,
  })
  const state = deriveJurisdictionCoverageState({
    workStatus: input.workStatus,
    sourceCount: input.sourceCount,
    requiredQuestionCount: JURISDICTION_QUESTIONS.length,
    verifiedCurrentClaimCount: projectedClaims.filter(claim =>
      claim.verificationState === 'VERIFIED' && claim.sourceAuthorityStatus === 'VERIFIED',
    ).length,
    staleClaimCount: coverage.staleClaimCount,
    blockedClaimCount: coverage.blockedClaimCount,
    pendingCandidateCount: input.pendingCandidates.length,
  })
  if (state !== 'VERIFIED') return null

  const claimIds = projectedClaims
    .filter(claim => claim.verificationState === 'VERIFIED' && claim.sourceAuthorityStatus === 'VERIFIED')
    .map(claim => claim.id)
    .sort()
  return `verified:${createHash('sha256').update(claimIds.join(':')).digest('hex')}`
}

export async function queueVerifiedCoverageNotifications(
  tx: Prisma.TransactionClient,
  jurisdictionId: string,
  now = new Date(),
) {
  const profile = await tx.jurisdictionProfile.findUnique({
    where: { jurisdictionId },
    select: {
      taxSale: true, foreclosure: true, recording: true, zoning: true, physical: true,
      permits: true, landlordTenant: true, section8: true, wholesale: true,
      marketSignals: true, contacts: true,
    },
  })
  const researchProfile = buildResearchProfile(profile)
  const projectedClaimIds = Object.values(researchProfile).flatMap(section =>
    Object.values(section).flatMap(field => field.claimId ? [field.claimId] : []),
  )
  const [work, sourceCount, activeClaims, pendingCandidates, demands] = await Promise.all([
    tx.jurisdictionResearchWork.findUnique({ where: { jurisdictionId }, select: { status: true } }),
    tx.jurisdictionSourceUrl.count({ where: { jurisdictionId } }),
    tx.jurisdictionClaim.findMany({
      where: { jurisdictionId, id: { in: projectedClaimIds }, supersededByClaim: null },
      select: {
        id: true, section: true, fieldKey: true, value: true, normalizedUnit: true,
        verificationState: true, sourceAuthorityStatus: true,
        freshness: { select: { reviewDueAt: true, staleAt: true } },
      },
    }),
    tx.extractionCandidate.findMany({
      where: { jurisdictionId, status: 'PENDING' },
      select: { section: true, fieldKey: true, extractedValue: true },
    }),
    tx.jurisdictionResearchDemand.findMany({
      where: { jurisdictionId },
      select: { id: true, tenantId: true, requestedBy: true },
    }),
  ])
  const coverageVersion = verifiedCoverageVersion({
    workStatus: work?.status ?? null,
    sourceCount,
    profile,
    activeClaims,
    pendingCandidates,
    now,
  })
  if (!coverageVersion || demands.length === 0) return 0

  const users = await tx.user.findMany({
    where: { OR: demands.map(demand => ({ id: demand.requestedBy, tenantId: demand.tenantId })) },
    select: { id: true, tenantId: true, email: true },
  })
  const emails = new Map(users.map(user => [`${user.tenantId}:${user.id}`, user.email]))
  const created = await tx.jurisdictionCoverageNotification.createMany({
    data: demands.map(demand => {
      const recipientEmail = emails.get(`${demand.tenantId}:${demand.requestedBy}`)
      return {
        demandId: demand.id,
        tenantId: demand.tenantId,
        jurisdictionId,
        coverageVersion,
        recipientEmail,
        status: recipientEmail ? 'PENDING' : 'SKIPPED_NO_RECIPIENT',
      }
    }),
    skipDuplicates: true,
  })
  return created.count
}
