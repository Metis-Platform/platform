import { db } from '@/lib/db'
import { Prisma } from '@/app/generated/prisma'
import { headers } from 'next/headers'
import { requestIdFromHeaders } from '@/lib/request-correlation'

type AuditAction =
  | 'DEAL_CREATED'
  | 'DEAL_ARCHIVED'
  | 'BLAST_SENT'
  | 'NOTE_PAYMENT_LOGGED'
  | 'CHECKLIST_CREATED'
  | 'LOGIN'
  | 'ADMIN_EMAIL_SENT'

export async function emitAuditEvent(
  tenantId: string,
  action: AuditAction,
  meta?: Record<string, unknown>,
  userId?: string,
  requestId?: string,
): Promise<void> {
  try {
    const correlatedRequestId = requestId ?? await currentRequestId()
    await db.auditEvent.create({
      data: {
        tenantId,
        userId: userId ?? null,
        requestId: correlatedRequestId,
        action,
        meta: meta ? (meta as Prisma.InputJsonValue) : undefined,
      },
    })
  } catch {
    // Audit failures must never block the calling operation
  }
}

async function currentRequestId() {
  try {
    return requestIdFromHeaders(await headers())
  } catch {
    return undefined
  }
}
