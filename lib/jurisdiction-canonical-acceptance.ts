import { Prisma } from '@/app/generated/prisma'
import { db } from './db'

export type CanonicalAcceptanceInput = {
  jurisdictionId: string
  contractVersion: string
  caseReference: string
  evidenceUrl: string
  result: 'PASSED' | 'FAILED'
  summary: string
  reviewerId: string
  replacesAcceptanceId?: string
  auditEvent: {
    tenantId: string
    userId: string
    requestId?: string
    action: string
    meta: Prisma.InputJsonValue
  }
}

export async function publishCanonicalAcceptance(input: CanonicalAcceptanceInput) {
  return db.$transaction(async tx => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "Jurisdiction" WHERE id = ${input.jurisdictionId} FOR UPDATE
    `
    if (locked.length !== 1) throw new Error('JURISDICTION_NOT_FOUND')

    const current = await tx.jurisdictionCanonicalAcceptance.findFirst({
      where: { jurisdictionId: input.jurisdictionId, supersededByAcceptance: null },
      select: { id: true },
      orderBy: { reviewedAt: 'desc' },
    })
    if (current?.id !== input.replacesAcceptanceId) {
      throw new Error('STALE_CANONICAL_ACCEPTANCE')
    }
    if (!current && input.replacesAcceptanceId) {
      throw new Error('STALE_CANONICAL_ACCEPTANCE')
    }

    const acceptance = await tx.jurisdictionCanonicalAcceptance.create({
      data: {
        jurisdictionId: input.jurisdictionId,
        contractVersion: input.contractVersion,
        caseReference: input.caseReference,
        evidenceUrl: input.evidenceUrl,
        result: input.result,
        summary: input.summary,
        reviewedBy: input.reviewerId,
        supersedesAcceptanceId: current?.id,
      },
      select: { id: true, result: true, reviewedAt: true },
    })
    await tx.auditEvent.create({ data: input.auditEvent })
    return { acceptanceId: acceptance.id, result: acceptance.result, reviewedAt: acceptance.reviewedAt }
  })
}
